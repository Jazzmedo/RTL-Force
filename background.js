chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ mode: 'blacklist', blacklist: [], whitelist: [], enabled: true });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkAndApplyRTL(tabId, tab);
    }
});

function checkAndApplyRTL(tabId, tab) {
    // First check if extension is enabled
    chrome.storage.sync.get(['enabled'], function(result) {
        if (result.enabled === false) {
            return; // Extension is disabled, don't do anything
        }

        // Continue with existing RTL logic
        chrome.storage.sync.get(['mode', 'blacklist', 'whitelist'], (data) => {
            const { mode, blacklist, whitelist } = data;
            const url = new URL(tab.url);
            const hostname = url.hostname;

            if (
                (mode === 'blacklist' && !blacklist.includes(hostname)) ||
                (mode === 'whitelist' && whitelist.includes(hostname))
            ) {
                chrome.tabs.executeScript(tabId, { file: 'content.js' });
            }
        });
    });
}