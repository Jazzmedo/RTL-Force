document.addEventListener('DOMContentLoaded', () => {
    const addToListButton = document.getElementById('add-to-list');
    const saveListButton = document.getElementById('save-list');
    const domainList = document.getElementById('domain-list');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const statusElement = document.getElementById('status');
    const themeToggle = document.getElementById('theme-toggle');
    const extensionToggle = document.getElementById('extension-toggle');
    const controlsContainer = document.getElementById('controls');

    // Initialize UI with stored settings
    chrome.storage.sync.get(['mode', 'blacklist', 'whitelist', 'theme', 'enabled'], (data) => {
        // Set mode selection
        document.querySelector(`input[name="mode"][value="${data.mode || 'blacklist'}"]`).checked = true;
        
        // Set domain list
        const currentMode = data.mode || 'blacklist';
        domainList.value = (data[currentMode] || []).join('\n');
        
        // Set theme
        if (data.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        
        // Set extension toggle state
        extensionToggle.checked = data.enabled !== false;
        controlsContainer.classList.toggle('disabled', !extensionToggle.checked);
        
        // Update button text based on current site
        updateButtonText();
    });

    // Add/Remove current domain
    addToListButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = new URL(tabs[0].url);
            const domain = url.hostname;
            const mode = document.querySelector('input[name="mode"]:checked').value;
            let currentDomains = domainList.value.split('\n').filter(Boolean);

            if (currentDomains.includes(domain)) {
                currentDomains = currentDomains.filter(d => d !== domain);
                showStatus('Domain removed!');
            } else {
                currentDomains.push(domain);
                showStatus('Domain added!');
            }

            domainList.value = currentDomains.join('\n');
            updateButtonText();
            
            // Save immediately
            chrome.storage.sync.set({
                [mode]: currentDomains
            }, () => broadcastState());
        });
    });

    // Save list manually
    saveListButton.addEventListener('click', () => {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        const domains = domainList.value.split('\n').filter(Boolean);

        chrome.storage.sync.set({
            [mode]: domains,
            mode: mode
        }, () => {
            showStatus('List saved!');
            broadcastState();
        });
    });

    // Handle mode changes
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            chrome.storage.sync.get([mode], (data) => {
                domainList.value = (data[mode] || []).join('\n');
                updateButtonText();
            });
            chrome.storage.sync.set({ mode: mode }, () => broadcastState());
        });
    });

    // Theme toggle
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        chrome.storage.sync.set({ theme: newTheme });
    });

    // Extension enable/disable toggle
    extensionToggle.addEventListener('change', () => {
        const enabled = extensionToggle.checked;
        chrome.storage.sync.set({ enabled: enabled }, () => {
            showStatus(`Extension ${enabled ? 'enabled' : 'disabled'}`);
            controlsContainer.classList.toggle('disabled', !enabled);
            broadcastState();
        });
    });

    // Status message helper
    function showStatus(message, duration = 2000) {
        statusElement.textContent = message;
        setTimeout(() => {
            statusElement.textContent = '';
        }, duration);
    }

    // Update button text based on current site
    function updateButtonText() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.url) return;
            
            const url = new URL(tabs[0].url);
            const domain = url.hostname;
            const currentDomains = domainList.value.split('\n').filter(Boolean);
            const isInList = currentDomains.includes(domain);

            addToListButton.textContent = isInList ? 'Remove Current Site' : 'Add Current Site';
            addToListButton.style.backgroundColor = isInList ? '#dc3545' : 'var(--button-bg)';
        });
    }

    // Broadcast state changes to all tabs
    function broadcastState() {
        chrome.storage.sync.get(['enabled', 'mode', 'blacklist', 'whitelist'], (data) => {
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.id) {
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'STATE_UPDATE',
                            enabled: data.enabled,
                            mode: data.mode,
                            lists: {
                                blacklist: data.blacklist || [],
                                whitelist: data.whitelist || []
                            }
                        });
                    }
                });
            });
        });
    }

    // Real-time updates for current tab
    chrome.tabs.onActivated.addListener(updateButtonText);
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.url) updateButtonText();
    });
});