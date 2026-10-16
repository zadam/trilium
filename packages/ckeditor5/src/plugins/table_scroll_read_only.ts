/**
 * Sizes the tables of saved content in `container` the way `TriliumTableScroll` sizes them in the
 * editor. Each table at the top level of `container` or in its lists gets its width as
 * `--table-width`, with a percentage turned into a share of `--table-reference-width`, and
 * `table_scroll.css` lets a table wider than the content scroll sideways. The saved `width` stays
 * on the figure, so a copied table keeps it.
 *
 * The module imports nothing from CKEditor, so pages that only display content can load it.
 */
export function applyTableScroll(container: Element) {
    const figures = container.querySelectorAll<HTMLElement>("figure.table:not(.layout-table)");
    for (const figure of figures) {
        if (isScrollable(figure, container)) {
            figure.style.setProperty("--table-width", toReferenceWidth(figure.style.width));
        }
    }
}

/**
 * Whether `figure` is at the top level of `container` or in its lists, where the editor keeps
 * tables at the top level of the document.
 */
function isScrollable(figure: HTMLElement, container: Element) {
    for (let parent = figure.parentElement; parent !== container; parent = parent.parentElement) {
        if (!parent || !LIST_ELEMENTS.has(parent.tagName)) {
            return false;
        }
    }
    return true;
}

const LIST_ELEMENTS = new Set(["UL", "OL", "LI"]);

/** Converts the saved table `width` to a CSS width relative to `--table-reference-width`. */
function toReferenceWidth(width: string) {
    if (!width) {
        return "var(--table-reference-width, 100%)";
    }
    if (width.endsWith("%")) {
        return `calc(var(--table-reference-width, 100%) * ${parseFloat(width)} / 100)`;
    }
    return width;
}
