document.addEventListener('DOMContentLoaded', () => {
    const addToListButton = document.getElementById('add-to-list');
    const saveListButton = document.getElementById('save-list');
    const domainList = document.getElementById('domain-list');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const statusElement = document.getElementById('status');
    const themeToggle = document.getElementById('theme-toggle');
    const modeInputs = document.querySelectorAll('input[name="mode"]');

    // Load saved settings
    chrome.storage.sync.get(['mode', 'blacklist', 'whitelist', 'theme'], (data) => {
        document.querySelector(`input[name="mode"][value="${data.mode}"]`).checked = true;
        domainList.value = data[data.mode].join('\n');
        if (data.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        updateButtonText();
    });

    // Add or remove current domain from the list
    addToListButton.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = new URL(tabs[0].url);
            const domain = url.hostname;
            const mode = document.querySelector('input[name="mode"]:checked').value;
            let currentDomains = domainList.value.split('\n').filter(Boolean);

            if (currentDomains.includes(domain)) {
                currentDomains = currentDomains.filter(d => d !== domain);
                showStatus('Domain removed!');
                addToListButton.textContent = 'Add Current Site';
                addToListButton.style.backgroundColor = 'var(--button-bg)';
            } else {
                currentDomains.push(domain);
                showStatus('Domain added!');
                addToListButton.textContent = 'Remove Current Site';
                addToListButton.style.backgroundColor = '#dc3545';
            }

            domainList.value = currentDomains.join('\n');

            // Save the updated list immediately
            chrome.storage.sync.set({
                [mode]: currentDomains,
                mode: mode
            }, () => {
                showStatus('List updated successfully!\nRefreash the page to see the changes.');
            });
        });
    });

    // Save the list
    saveListButton.addEventListener('click', () => {
        const mode = document.querySelector('input[name="mode"]:checked').value;
        const domains = domainList.value.split('\n').filter(Boolean);

        chrome.storage.sync.set({
            [mode]: domains,
            mode: mode
        }, () => {
            showStatus('List saved successfully!\nRefreash the page to see the changes.');
        });
    });

    // Update mode
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (event) => {
            const mode = event.target.value;
            chrome.storage.sync.get([mode], (data) => {
                domainList.value = (data[mode] || []).join('\n');
                updateButtonText();
            });
        });
    });

    // Add event listeners for mode selection
    modeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            saveMode(e.target.value);
        });
    });

    // When the popup loads, get the saved mode
    chrome.storage.sync.get(['mode'], (result) => {
        if (result.mode) {
            document.querySelector(`input[value="${result.mode}"]`).checked = true;
        }
    });

    // Theme handling
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        chrome.storage.sync.set({ theme: newTheme });
    });

    function showStatus(message) {
        statusElement.textContent = message;
        setTimeout(() => {
            statusElement.textContent = '';
        }, 2000);
    }

    function updateButtonText() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = new URL(tabs[0].url);
            const domain = url.hostname;
            const currentDomains = domainList.value.split('\n').filter(Boolean);

            if (currentDomains.includes(domain)) {
                addToListButton.textContent = 'Remove Current Site';
                addToListButton.style.backgroundColor = '#dc3545';
            } else {
                addToListButton.textContent = 'Add Current Site';
                addToListButton.style.backgroundColor = 'var(--button-bg)';
            }
        });
    }

    // Add this function to save the mode
    function saveMode(mode) {
        chrome.storage.sync.set({ mode: mode }, () => {
            showStatus('Mode saved!');
        });
    }
});