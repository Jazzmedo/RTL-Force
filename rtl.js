function updateTextDirections() {
    document.querySelectorAll("*").forEach((element) => {
        // Check if the element contains Arabic characters using Unicode range
        const arabicRegex =
            /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

        // Check only direct text content of the element (not nested elements)
        const textNodes = Array.from(element.childNodes).filter(
            (node) => node.nodeType === Node.TEXT_NODE
        );

        const hasArabic = textNodes.some((node) =>
            arabicRegex.test(node.textContent)
        );

        if (hasArabic && element.parentElement) {
            element.parentElement.setAttribute("dir", "rtl");
        }
    });
}

// Run on initial load
updateTextDirections();

// Run again whenever new content is added
// (e.g., after AJAX calls or dynamic element creation)
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === "childList" || mutation.type === "characterData") {
            updateTextDirections();
            break;
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
});