// Initialize default settings
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        mode: 'blacklist',
        blacklist: [],
        whitelist: [],
        enabled: true
    });
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkAndApplyRTL(tabId, tab);
    }
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
    const { enabled } = await chrome.storage.sync.get('enabled');
    if (!enabled) return;

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

    if (shouldApply) {
        chrome.scripting.executeScript({
            target: { tabId },
            files: ['content.js']
        });
    } else {
        // Remove RTL effects if needed
        chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                document.querySelectorAll('[dir="rtl"]').forEach(el => {
                    el.removeAttribute('dir');
                });
            }
        });
    }
}