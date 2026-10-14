import {
    type ModelElement, TableScrollEditing, type ViewDowncastWriter, type ViewElement
} from "ckeditor5";

/** The CSS property that sets the width a table takes as its full width. */
export const REFERENCE_WIDTH_PROPERTY = "--table-reference-width";

const OVERFLOWING_CLASS = "ck-table-overflowing";

/**
 * CKEditor's `TableScrollEditing`, which lets a table wider than the editable scroll sideways,
 * extended in two ways:
 *
 * - A table also scrolls when its content is wider than the editable, whatever its saved width.
 * - Where the editable sets `--table-reference-width`, a percentage width is a share of it instead
 *   of the editable's width, and a table with no width spans all of it. The mobile layout sets it
 *   to the maximum content width.
 *
 * The plugin keeps the upstream name, which `TableColumnResizeEditing` looks up to let a table grow
 * past the editable. Column resizing is off while a reference width applies, because the resizer
 * computes percentages of the editable's width.
 */
export default class TriliumTableScroll extends TableScrollEditing {

    /** The figures of the tables that scroll because their content is wider than the editable. */
    private readonly contentOverflowing = new WeakSet<ViewElement>();

    private readonly onContentLoad = () => this.updateContentOverflow();

    /** The editable that `onContentLoad` listens to. */
    private loadTarget: HTMLElement | undefined;

    override init() {
        super.init();

        const { editor } = this;
        this.listenTo(editor.editing.view, "render", () => this.updateContentOverflow());
        editor.once("ready", () => {
            // An image that loads after a render can make its table wider.
            this.loadTarget = editor.editing.view.getDomRoot();
            this.loadTarget?.addEventListener("load", this.onContentLoad, true);

            if (this.readReferenceWidth() !== null && editor.plugins.has("TableColumnResize")) {
                editor.plugins.get("TableColumnResize").forceDisabled("TriliumTableScroll");
            }
        });
    }

    override destroy() {
        this.loadTarget?.removeEventListener("load", this.onContentLoad, true);
        super.destroy();
    }

    override _updateTableScrollOverflowState(
        table: ModelElement,
        tableWidthOverride?: string | null
    ) {
        // The upstream state replaces the content overflow, which the next render checks again.
        const viewFigure = this.editor.editing.mapper.toViewElement(table);
        if (viewFigure && this.contentOverflowing.delete(viewFigure)) {
            this.editor.editing.view.change((writer) => {
                setContentOverflow(writer, viewFigure, false);
            });
        }

        const referenceWidth = this.getReferenceWidth(table);
        if (referenceWidth === null) {
            super._updateTableScrollOverflowState(table, tableWidthOverride);
            return;
        }

        const tableWidth = tableWidthOverride === undefined
            ? getSavedWidth(table)
            : tableWidthOverride;
        super._updateTableScrollOverflowState(table, toReferencePixels(tableWidth, referenceWidth));
    }

    /**
     * The full width of `table` in pixels, or `null` when no reference width applies to it: the
     * editable does not set one, or the table cannot scroll.
     */
    getReferenceWidth(table: ModelElement): number | null {
        return this._isTableScrollable(table) ? this.readReferenceWidth() : null;
    }

    /** The `--table-reference-width` of the editable in pixels, or `null` when it is not set. */
    private readReferenceWidth() {
        const domRoot = this.editor.editing.view.getDomRoot();
        if (!domRoot) {
            return null;
        }

        const value = getComputedStyle(domRoot).getPropertyValue(REFERENCE_WIDTH_PROPERTY);
        const width = parseFloat(value);
        return width > 0 ? width : null;
    }

    /**
     * Lets each scrollable table whose saved width fits the editable scroll while its content is
     * wider, and stop once the content fits again.
     */
    private updateContentOverflow() {
        const { editing } = this.editor;
        const changes: ContentOverflowChange[] = [];
        const tables = [...editing.model.document.getRoots()]
            .flatMap((root) => [...root.getChildren()]);
        for (const table of tables) {
            if (!table.is("element", "table") || !this._isTableScrollable(table)) {
                continue;
            }

            const viewFigure = editing.mapper.toViewElement(table);
            /* v8 ignore next 3 -- defensive: a root table is converted before the view renders */
            if (!viewFigure) {
                continue;
            }

            const wasOverflowing = this.contentOverflowing.has(viewFigure);
            if (viewFigure.hasClass(OVERFLOWING_CLASS) && !wasOverflowing) {
                continue;
            }

            const isOverflowing = this.isWiderThanContainer(viewFigure);
            if (isOverflowing !== wasOverflowing) {
                changes.push({ table, viewFigure, isOverflowing });
            }
        }
        if (!changes.length) {
            return;
        }

        editing.view.change((writer) => {
            for (const { viewFigure, isOverflowing } of changes) {
                setContentOverflow(writer, viewFigure, isOverflowing);
                if (isOverflowing) {
                    this.contentOverflowing.add(viewFigure);
                } else {
                    this.contentOverflowing.delete(viewFigure);
                }
            }
        });

        // The upstream state of a table that fits again brings back its width.
        for (const { table, isOverflowing } of changes) {
            if (!isOverflowing) {
                this._updateTableScrollOverflowState(table);
            }
        }
    }

    /** Whether the table of `viewFigure` extends past the content box of the figure's parent. */
    private isWiderThanContainer(viewFigure: ViewElement) {
        const domFigure = this.editor.editing.view.domConverter.mapViewToDom(viewFigure);
        const domTable = domFigure?.querySelector(":scope > table");
        const domParent = domFigure?.parentElement;
        /* v8 ignore next 3 -- defensive: a rendered figure has a table and a parent element */
        if (!domTable || !domParent) {
            return false;
        }

        const container = getContentBox(domParent);
        const table = domTable.getBoundingClientRect();
        return table.left < container.left - 0.5 || table.right > container.right + 0.5;
    }

}

interface ContentOverflowChange {
    table: ModelElement;
    viewFigure: ViewElement;
    isOverflowing: boolean;
}

/**
 * Puts `viewFigure` into the scrolling state, or takes it out of it. In the scrolling state the
 * table keeps the width its content needs, and the figure has no width.
 */
function setContentOverflow(
    writer: ViewDowncastWriter,
    viewFigure: ViewElement,
    isOverflowing: boolean
) {
    if (isOverflowing) {
        writer.addClass(OVERFLOWING_CLASS, viewFigure);
        writer.removeStyle("width", viewFigure);
    } else {
        writer.removeClass(OVERFLOWING_CLASS, viewFigure);
        writer.removeStyle("--ck-table-scroll-offset", viewFigure);
    }
}

function getSavedWidth(table: ModelElement) {
    const width = table.getAttribute("tableWidth");
    return typeof width === "string" ? width : null;
}

/** The left and right edges of the content box of `element`, in viewport coordinates. */
function getContentBox(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
        left: rect.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        right: rect.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight)
    };
}

/**
 * Converts the saved table `width` to pixels of `referenceWidth`: a percentage is a share of it,
 * no width is all of it, and other units stay as they are.
 */
function toReferencePixels(width: string | null, referenceWidth: number) {
    if (!width) {
        return `${referenceWidth}px`;
    }
    if (width.endsWith("%")) {
        return `${parseFloat(width) / 100 * referenceWidth}px`;
    }
    return width;
}
