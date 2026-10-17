/**
 * Measures the header rows of content tables for `table_sticky_header.css`, which keeps them at
 * the top of the scrolled area while the rest of their table passes under them.
 *
 * The module imports nothing from CKEditor, so pages that only display content can load it.
 */

/** The distance from the top of the figure to the header rows, set on the `thead`. */
export const START_PROPERTY = "--table-header-start";

/** The distance from the bottom of the header rows to the bottom of the table. */
export const TRAVEL_PROPERTY = "--table-header-travel";

/**
 * Keeps the header rows of the tables in `container` in view while it scrolls. Returns a function
 * that stops measuring them.
 */
export function applyStickyTableHeaders(container: Element) {
    const headers = new StickyTableHeaders();
    headers.observe(container);
    return () => headers.disconnect();
}

/** Measures header rows again whenever their figure or the rows themselves change size. */
export class StickyTableHeaders {

    private observer: ResizeObserver | undefined;

    private readonly observed = new Set<Element>();

    /** The figures to measure in the next animation frame. */
    private readonly resized = new Set<Element>();

    private frame: number | undefined;

    /**
     * Starts measuring the header rows in `container` that are not measured yet, and stops
     * measuring the ones removed from the document.
     */
    observe(container: Element) {
        for (const element of this.observed) {
            if (!element.isConnected) {
                this.observer?.unobserve(element);
                this.observed.delete(element);
            }
        }

        const figures = container.querySelectorAll("figure.table:not(.layout-table)");
        for (const figure of figures) {
            const thead = figure.querySelector(":scope > table > thead");
            if (thead) {
                this.watch(figure);
                this.watch(thead);
            }
        }
    }

    disconnect() {
        this.observer?.disconnect();
        this.observed.clear();
        this.resized.clear();
    }

    private watch(element: Element) {
        if (!this.observed.has(element)) {
            this.observer ??= new ResizeObserver((entries) => this.onResize(entries));
            this.observer.observe(element);
            this.observed.add(element);
        }
    }

    private onResize(entries: ResizeObserverEntry[]) {
        for (const { target } of entries) {
            const figure = target.closest("figure");
            if (figure) {
                this.resized.add(figure);
            }
        }

        // Chromium drops a range change made in the frame that creates the animation.
        this.frame ??= requestAnimationFrame(() => this.measureResized());
    }

    private measureResized() {
        this.frame = undefined;
        for (const figure of this.resized) {
            if (figure.isConnected) {
                measure(figure);
            }
        }
        this.resized.clear();
    }

}

/**
 * The bottom of the header rows of `table` in the viewport while they stick, or `null` while they
 * rest at the top of the table.
 */
export function getStuckHeaderBottom(table: Element) {
    const thead = table.querySelector<HTMLElement>(":scope > thead");
    return thead && getShift(thead) > 0 ? thead.getBoundingClientRect().bottom : null;
}

/** Sets the start and the travel of the header rows, measured without the shift of sticking. */
function measure(figure: Element) {
    const table = figure.querySelector(":scope > table");
    const thead = table?.querySelector<HTMLElement>(":scope > thead");
    if (!table || !thead) {
        return;
    }

    const shift = getShift(thead);
    const header = thead.getBoundingClientRect();
    const start = header.top - shift - figure.getBoundingClientRect().top;
    const travel = table.getBoundingClientRect().bottom - (header.bottom - shift);
    setLength(thead, START_PROPERTY, start);
    setLength(thead, TRAVEL_PROPERTY, travel);
}

/** The vertical `translate` that the running animation gives `element`. */
function getShift(element: HTMLElement) {
    const [ , y = "0" ] = getComputedStyle(element).translate.split(" ");
    return parseFloat(y);
}

/** Sets a length in pixels, leaving the style alone when the value is the same. */
function setLength(element: HTMLElement, property: string, pixels: number) {
    const value = `${Math.round(pixels * 100) / 100}px`;
    if (element.style.getPropertyValue(property) !== value) {
        element.style.setProperty(property, value);
    }
}
