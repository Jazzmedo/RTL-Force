(() => {
    var TEXT_DIRECTION_CACHE = new WeakMap();
    let isEnabled = true;
    let rtlMode = false; // false = Text Direction mode (default), true = HTML Dir Only mode
    let observer;

    function countWords(text) {
        if (!text.trim()) return { arabic: 0, english: 0, ratio: 0 };

        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const englishPattern = /[a-zA-Z]/;
        
        const words = text.split(/\s+/);
        let arabicCount = 0;
        let englishCount = 0;

        words.forEach(word => {
            if (!word.trim()) return;
            const firstChar = word[0];
            if (arabicPattern.test(firstChar)) {
                arabicCount++;
            } else if (englishPattern.test(firstChar)) {
                englishCount++;
            }
        });

        return {
            arabic: arabicCount,
            english: englishCount,
            ratio: englishCount > 0 ? arabicCount / englishCount : arabicCount > 0 ? Infinity : 0
        };
    }

    function findDeepestTextNodes(element) {
        const textNodes = [];
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            },
            false
        );

        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        return textNodes;
    }

    function getDirectParent(node) {
        let parent = node.parentElement;
        while (parent && parent !== document.body) {
            const display = window.getComputedStyle(parent).display;
            if (display.includes('block') || display === 'flex' || display === 'grid') {
                return parent;
            }
            parent = parent.parentElement;
        }
        return null;
    }

    function handleListElement(listElement) {
        if (TEXT_DIRECTION_CACHE.has(listElement)) {
            return TEXT_DIRECTION_CACHE.get(listElement);
        }

        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const listItems = Array.from(listElement.children);

        for (const item of listItems) {
            const textNodes = findDeepestTextNodes(item);
            for (const textNode of textNodes) {
                const text = textNode.textContent.trim();
                if (text && arabicPattern.test(text[0])) {
                    TEXT_DIRECTION_CACHE.set(listElement, true);
                    return true;
                }
            }
        }
        
        TEXT_DIRECTION_CACHE.set(listElement, false);
        return false;
    }

    function updateTextDirections() {
        if (!isEnabled) return;
        
        // If in HTML Dir Only mode, just set the dir attribute on the HTML element
        if (rtlMode) {
            document.documentElement.setAttribute('dir', 'rtl');
            document.documentElement.setAttribute('forcertl', 't');
            return;
        }

        // Function to check if element has explicit direction set
        function hasExplicitDirection(element) {
            // Check if element or any of its ancestors has explicit RTL direction
            let currentElement = element;
            while (currentElement && currentElement !== document.documentElement) {
                const computedStyle = window.getComputedStyle(currentElement);
                const dirAttribute = currentElement.getAttribute('dir');
                if (computedStyle.direction === 'rtl' || dirAttribute === 'rtl') {
                    return true;
                }
                currentElement = currentElement.parentElement;
            }
            return false;
        }

        // Handle headings first - set RTL if contains any Arabic text in deepest text nodes
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            if (hasExplicitDirection(heading)) return; // Skip if already RTL by default
            
            const textNodes = findDeepestTextNodes(heading);
            let totalText = '';
            textNodes.forEach(node => {
                totalText += node.textContent.trim() + ' ';
            });
            const { arabic } = countWords(totalText);
            if (arabic > 0) {
                heading.setAttribute('dir', 'rtl');
                heading.setAttribute('forcertl', 't');
            } else {
                heading.removeAttribute('dir');
            }
        });

        // Handle lists (ul/ol)
        document.querySelectorAll('ul, ol').forEach(listElement => {
            if (hasExplicitDirection(listElement)) return; // Skip if already RTL by default
            
            if (handleListElement(listElement)) {
                listElement.setAttribute('dir', 'rtl');
                listElement.setAttribute('forcertl', 't');
            } else {
                listElement.removeAttribute('dir');
            }
        });

        // Process all other elements
        const processedParents = new Set();
        document.body.childNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const textNodes = findDeepestTextNodes(node);
                
                textNodes.forEach(textNode => {
                    const directParent = getDirectParent(textNode);
                    if (directParent && !processedParents.has(directParent)) {
                        if (directParent.tagName.toLowerCase() !== 'ul' && 
                            directParent.tagName.toLowerCase() !== 'ol' &&
                            !hasExplicitDirection(directParent)) { // Skip if already RTL by default
                            
                            const { ratio } = countWords(textNode.textContent);
                            if (ratio >= 1.5) {
                                directParent.setAttribute('dir', 'rtl');
                                directParent.setAttribute('forcertl', 't');
                            } else {
                                directParent.removeAttribute('dir');
                            }
                            processedParents.add(directParent);
                        }
                    }
                });
            }
        });

        // Ensure pre tags are always LTR
        document.querySelectorAll('pre').forEach(pre => {
            pre.setAttribute('dir', 'ltr');
        });
    }

    function initObserver() {
        observer = new MutationObserver((mutations) => {
            const shouldUpdate = mutations.some(mutation => 
                mutation.type === 'childList' || 
                mutation.type === 'characterData'
            );

            if (shouldUpdate) {
                mutations.forEach(mutation => {
                    if (mutation.target) {
                        TEXT_DIRECTION_CACHE.delete(mutation.target);
                    }
                });
                updateTextDirections();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function cleanupRTL() {
        document.querySelectorAll('[forcertl="t"]').forEach(el => {
            el.removeAttribute('dir');
            el.removeAttribute('forcertl');
        });
        document.querySelectorAll('[dir="ltr"]').forEach(el => el.removeAttribute('dir'));
        // Also remove RTL from HTML element if it was set by HTML Dir Only mode
        if (document.documentElement.getAttribute('forcertl') === 't') {
            document.documentElement.removeAttribute('dir');
            document.documentElement.removeAttribute('forcertl');
        }
        TEXT_DIRECTION_CACHE = new WeakMap();
    }

    // Initialize immediately
    updateTextDirections();
    initObserver();

    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'EXTENSION_STATE') {
            isEnabled = request.enabled;
            rtlMode = request.rtlMode;
            
            // 1. First check if extension is enabled
            if (!isEnabled) {
                cleanupRTL();
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                return;
            }
            
            // 2. Check if current site is in whitelist/blacklist
            if (request.lists) {
                const hostname = window.location.hostname;
                const mode = request.mode;
                const blacklist = request.lists.blacklist || [];
                const whitelist = request.lists.whitelist || [];
                
                const shouldApply = 
                    (mode === 'blacklist' && !blacklist.includes(hostname)) ||
                    (mode === 'whitelist' && whitelist.includes(hostname));
                
                if (!shouldApply) {
                    cleanupRTL();
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                    return;
                }
            }
            
            // 3. Apply the selected direction mode
            updateTextDirections();
            // Only initialize observer in Text Direction mode
            if (!rtlMode && !observer) {
                initObserver();
            } else if (rtlMode && observer) {
                // Disconnect observer in HTML Dir Only mode
                observer.disconnect();
                observer = null;
            }
        }
    });
    
    // Also listen for STATE_UPDATE messages from popup.js
    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'STATE_UPDATE') {
            rtlMode = request.rtlMode;
            isEnabled = request.enabled;
            
            // First check if extension is enabled
            if (!isEnabled) {
                cleanupRTL();
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                return;
            }
            
            // Then check whitelist/blacklist status
            if (request.lists) {
                const hostname = window.location.hostname;
                const mode = request.mode;
                const blacklist = request.lists.blacklist || [];
                const whitelist = request.lists.whitelist || [];
                
                const shouldApply = 
                    (mode === 'blacklist' && !blacklist.includes(hostname)) ||
                    (mode === 'whitelist' && whitelist.includes(hostname));
                
                if (!shouldApply) {
                    cleanupRTL();
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                    return;
                }
            }
            
            // Finally apply the selected direction mode
            // Clean up previous RTL settings before applying new mode
            cleanupRTL();
            updateTextDirections();
            
            // Manage observer based on mode
            if (!rtlMode && !observer) {
                initObserver();
            } else if (rtlMode && observer) {
                observer.disconnect();
                observer = null;
            }
        }
    });
})();