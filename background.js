// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        mode: 'blacklist',
        blacklist: [],
        whitelist: [],
        enabled: true
    });
});

// Keep track of RTL state per tab
const tabStates = new Map();

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkAndApplyRTL(tabId, tab);
    }
});

// Clean up tab state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
});

// Handle extension state changes
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled || changes.mode || changes.blacklist || changes.whitelist) {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url) checkAndApplyRTL(tab.id, tab);
            });
        });
    }
});

async function checkAndApplyRTL(tabId, tab) {
    try {
        // Skip processing for restricted URLs
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
            return;
        }

        const { enabled } = await chrome.storage.sync.get('enabled');
        if (!enabled) {
            await sendStateToTab(tabId, false);
            return;
        }

    const { mode, blacklist, whitelist } = await chrome.storage.sync.get([
        'mode',
        'blacklist',
        'whitelist'
    ]);

    const url = new URL(tab.url);
    const hostname = url.hostname;

    const shouldApply =
        (mode === 'blacklist' && !blacklist.includes(hostname)) ||
        (mode === 'whitelist' && whitelist.includes(hostname));

    // Store the state for this tab
    tabStates.set(tabId, shouldApply);

    if (shouldApply) {
        // First send the state, then execute the content script
        sendStateToTab(tabId, true);
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
    } else {
        // Send disabled state
        await sendStateToTab(tabId, false);
        // Remove RTL effects if URL is accessible
        if (!tab.url.startsWith('chrome://')) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId },
                    func: () => {
                        document.querySelectorAll('[dir="rtl"]').forEach(el => {
                            el.removeAttribute('dir');
                        });
                    }
                });
            } catch (error) {
                console.debug(`Failed to execute script on tab ${tabId}:`, error.message);
            }
        }
    }
    } catch (error) {
        console.debug(`Error in checkAndApplyRTL for tab ${tabId}:`, error.message);
    }
}

async function sendStateToTab(tabId, enabled) {
    try {
        // Check if the tab still exists before sending message
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url) return;

        // Skip restricted URLs
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('edge://') || 
            tab.url.startsWith('about:')) {
            return;
        }

        await chrome.tabs.sendMessage(tabId, {
            type: 'EXTENSION_STATE',
            enabled: enabled
        });
    } catch (error) {
        // Ignore errors when tab doesn't exist or doesn't have content script yet
        if (!error.message.includes('receiving end does not exist')) {
            console.debug(`Failed to send state to tab ${tabId}:`, error.message);
        }
    }
}