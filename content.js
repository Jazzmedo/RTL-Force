(() => {
    var TEXT_DIRECTION_CACHE = new WeakMap();
    let isEnabled = true;
    let observer;

    function countWords(text) {
        if (!text.trim()) return { arabic: 0, other: 0, total: 0 };

        const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
        const latinPattern = /[a-zA-Z]/;
        
        const words = text.split(/\s+/);
        let arabicCount = 0;
        let latinCount = 0;
        let currentArabicSequence = 0;
        let currentLatinSequence = 0;
        let maxArabicSequence = 0;
        let maxLatinSequence = 0;

        words.forEach(word => {
            if (!word.trim()) return;
            
            const firstChar = word[0];
            const isArabicWord = arabicPattern.test(firstChar);
            const isLatinWord = latinPattern.test(firstChar);

            if (isArabicWord) {
                arabicCount++;
                currentArabicSequence++;
                currentLatinSequence = 0;
                maxArabicSequence = Math.max(maxArabicSequence, currentArabicSequence);
            } else if (isLatinWord) {
                latinCount++;
                currentLatinSequence++;
                currentArabicSequence = 0;
                maxLatinSequence = Math.max(maxLatinSequence, currentLatinSequence);
            }
        });

        return {
            arabic: arabicCount,
            other: latinCount,
            total: words.length,
            maxArabicSequence,
            maxLatinSequence
        };
    }

    function determineDirection(element) {
        if (TEXT_DIRECTION_CACHE.has(element)) {
            return TEXT_DIRECTION_CACHE.get(element);
        }

        let allText = '';
        if (element.tagName.toLowerCase() === 'ul' || element.tagName.toLowerCase() === 'ol') {
            allText = element.textContent;
        } else {
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while (node = walker.nextNode()) {
                allText += node.textContent + ' ';
            }
        }

        const { arabic, other, total, maxArabicSequence, maxLatinSequence } = countWords(allText);
        
        if (total === 0) return null;

        const arabicRatio = arabic / total;
        const direction = (maxArabicSequence >= 2 && arabicRatio >= 0.3) ? 'rtl' : null;

        TEXT_DIRECTION_CACHE.set(element, direction);
        return direction;
    }

    function updateTextDirections() {
        if (!isEnabled) return;

        const textElements = document.querySelectorAll('*');
        const processedParents = new Set();

        textElements.forEach(element => {
            if (!element.textContent.trim()) return;
            
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
                const display = window.getComputedStyle(parent).display;
                if (display.includes('block') || display === 'flex' || display === 'grid' || parent.tagName.toLowerCase() === 'ul' || parent.tagName.toLowerCase() === 'ol') {
                    if (!processedParents.has(parent)) {
                        processedParents.add(parent);
                        const direction = determineDirection(parent);
                        
                        if (direction === 'rtl') {
                            parent.setAttribute('dir', 'rtl');
                            const preTags = parent.querySelectorAll('pre');
                            preTags.forEach(pre => {
                                pre.setAttribute('dir', 'ltr');
                            });
                        } else {
                            parent.removeAttribute('dir');
                            const preTags = parent.querySelectorAll('pre');
                            preTags.forEach(pre => {
                                pre.removeAttribute('dir');
                            });
                        }
                    }
                    break;
                }
                parent = parent.parentElement;
            }
        });

        const preTags = document.querySelectorAll('pre');
        preTags.forEach(pre => {
            let ancestor = pre.parentElement;
            while (ancestor && ancestor !== document.body) {
                if (ancestor.getAttribute('dir') === 'rtl') {
                    pre.setAttribute('dir', 'ltr');
                    break;
                }
                ancestor = ancestor.parentElement;
            }
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
            characterData: true,
            attributes: true,
            attributeFilter: ['dir']
        });
    }

    function cleanupRTL() {
        document.querySelectorAll('[dir="rtl"]').forEach(el => el.removeAttribute('dir'));
        document.querySelectorAll('[dir="ltr"]').forEach(el => el.removeAttribute('dir'));
        TEXT_DIRECTION_CACHE = new WeakMap();
    }

    // Extension state management
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

    // Instead of checking storage on load, wait for the background script to send the state
    // Remove the initial storage check
    // The background script will send the correct state for this tab
})();