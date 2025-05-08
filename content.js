(() => {
    var TEXT_DIRECTION_CACHE = new WeakMap();
    let isEnabled = true;
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

        // Handle headings first - set RTL if contains any Arabic text in deepest text nodes
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
            const textNodes = findDeepestTextNodes(heading);
            let totalText = '';
            textNodes.forEach(node => {
                totalText += node.textContent.trim() + ' ';
            });
            const { arabic } = countWords(totalText);
            if (arabic > 0) {
                heading.setAttribute('dir', 'rtl');
            } else {
                heading.removeAttribute('dir');
            }
        });

        // Handle lists (ul/ol)
        document.querySelectorAll('ul, ol').forEach(listElement => {
            if (handleListElement(listElement)) {
                listElement.setAttribute('dir', 'rtl');
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
                            directParent.tagName.toLowerCase() !== 'ol') {
                            
                            const { ratio } = countWords(textNode.textContent);
                            if (ratio >= 1.5) {
                                directParent.setAttribute('dir', 'rtl');
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
        document.querySelectorAll('[dir="rtl"]').forEach(el => el.removeAttribute('dir'));
        document.querySelectorAll('[dir="ltr"]').forEach(el => el.removeAttribute('dir'));
        TEXT_DIRECTION_CACHE = new WeakMap();
    }

    // Initialize immediately
    updateTextDirections();
    initObserver();

    chrome.runtime.onMessage.addListener((request) => {
        if (request.type === 'EXTENSION_STATE') {
            isEnabled = request.enabled;
            if (!isEnabled) {
                cleanupRTL();
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
            } else {
                updateTextDirections();
                if (!observer) {
                    initObserver();
                }
            }
        }
    });
})();