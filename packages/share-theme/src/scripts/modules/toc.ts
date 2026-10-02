let previousRun: AbortController | null = null;

/**
 * The ToC is now generated in the page template so
 * it even exists for users without client-side js
 * and that means it loads with the page so it avoids
 * all potential reshuffling or layout recalculations.
 *
 * So, all this function needs to do is make the links
 * perform smooth animation, and adjust the "active"
 * entry as the user scrolls.
 */
export default function setupToC() {
    // A collaboration page swaps its note in place and runs this again; ending the previous run's
    // listeners keeps them from stacking up.
    previousRun?.abort();
    previousRun = new AbortController();
    const { signal } = previousRun;

    const container = document.getElementById("right-pane");
    const toc = document.getElementById("toc");
    const content = document.getElementById("content");
    if (!toc || !container || !content) return;

    // Get all relevant elements
    const sections = content.querySelectorAll("h2, h3, h4, h5, h6");
    const links = toc.querySelectorAll("a");

    // Setup smooth scroll on click
    for (const link of links) {
        link.addEventListener("click", e => {
            const target = document.querySelector(link.getAttribute("href")!);
            if (!target) return;
            e.preventDefault();
            e.stopPropagation();

            target.scrollIntoView({behavior: "smooth"});
        }, { signal });
    }

    // Setup a moving "active" in the ToC that adjusts with the scroll state
    function changeLinkState() {
        if (sections.length === 0 || links.length === 0) return;

        let index = sections.length;
        // A collaboration page's header stays over the top of the note while it scrolls.
        const top = (container?.scrollTop ?? 0) + 50
            + (document.getElementById("collab-header")?.offsetHeight ?? 0);

        // Work backwards to find the first matching section
        // eslint-disable-next-line no-empty
        while (--index && top < (sections[index] as HTMLElement).offsetTop) {}

        // Update the "active" item in ToC
        links.forEach((link) => link.classList.remove("active"));
        links[index]?.classList.add("active");
    }

    // Initial render
    changeLinkState();
    container.addEventListener("scroll", changeLinkState, { signal });
}
