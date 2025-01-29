const TEXT_DIRECTION_CACHE = new WeakMap();
const RTL_THRESHOLD = 0.5; // If more than 50% Arabic words, switch to RTL

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
        
        // Check first character of the word to determine primary script
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

    // Use a combination of ratio and sequence length to determine direction
    const arabicRatio = arabic / total;
    
    // If we have a long sequence of Latin text, prefer LTR
    if (maxLatinSequence > 3) {
        return null;
    }
    
    // If we have a significant Arabic sequence and ratio, use RTL
    const direction = (maxArabicSequence >= 2 && arabicRatio >= 0.3) ? 'rtl' : null;

    TEXT_DIRECTION_CACHE.set(element, direction);
    return direction;
}

function updateTextDirections() {
    // Find all text-containing elements
    const textElements = document.querySelectorAll('*');
    const processedParents = new Set();

    textElements.forEach(element => {
        // Skip elements that don't contain text
        if (!element.textContent.trim()) return;
        
        // Find the nearest block-level parent
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            const display = window.getComputedStyle(parent).display;
            if (display.includes('block') || display === 'flex' || display === 'grid' || parent.tagName.toLowerCase() === 'ul' || parent.tagName.toLowerCase() === 'ol') {
                if (!processedParents.has(parent)) {
                    processedParents.add(parent);
                    const direction = determineDirection(parent);
                    
                    if (direction === 'rtl') {
                        parent.setAttribute('dir', 'rtl');
                        // Handle pre tags inside the parent
                        const preTags = parent.querySelectorAll('pre');
                        preTags.forEach(pre => {
                            pre.setAttribute('dir', 'ltr');
                        });
                    } else {
                        parent.removeAttribute('dir');
                        // Handle pre tags inside the parent
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

    // Handle pre tags separately to ensure they are set correctly
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

// Initial update
updateTextDirections();

// Observe changes
const observer = new MutationObserver((mutations) => {
    const shouldUpdate = mutations.some(mutation => 
        mutation.type === 'childList' || 
        mutation.type === 'characterData'
    );

    if (shouldUpdate) {
        // Clear cache for modified elements
        mutations.forEach(mutation => {
            if (mutation.target) {
                TEXT_DIRECTION_CACHE.delete(mutation.target);
            }
        });
        updateTextDirections();
    }
});

// Update the observer configuration
observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['dir']
});