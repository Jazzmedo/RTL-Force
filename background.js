chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ mode: 'blacklist', blacklist: [], whitelist: [] });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        chrome.storage.sync.get(['mode', 'blacklist', 'whitelist'], (data) => {
            const { mode, blacklist, whitelist } = data;
            const url = new URL(tab.url);
            const hostname = url.hostname;

            if (
                (mode === 'blacklist' && !blacklist.includes(hostname)) ||
                (mode === 'whitelist' && whitelist.includes(hostname))
            ) {
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['rtl.js']
                });
            }
        });
    }
});