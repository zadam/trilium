import {
    Command, type Editor, type ModelElement, ModelLivePosition, type ModelPosition, type ModelWriter
} from "ckeditor5";

import {
    COLUMN_RATIOS, ELEMENTS, getColumnCount, getDefaultRatios, MAX_COLUMNS, MIN_COLUMNS,
    RATIOS_ATTRIBUTE
} from "./constants.js";

/** Where content or a column goes, relative to the current column. */
export type ColumnTarget = "previous" | "next" | "first" | "last";

/**
 * Inserts a layout with the column weights `value`, two equal columns by default, at the selection.
 * Selected content moves into the first column, and the caret goes to the end of that column.
 */
export class InsertMulticolumnLayoutCommand extends Command {

    public override refresh(): void {
        const model = this.editor.model;
        const position = model.document.selection.getFirstPosition();
        this.isEnabled = !!position && !!model.schema.findAllowedParent(position, ELEMENTS.layout);
    }

    public override execute(
        { value = getDefaultRatios(MIN_COLUMNS) }: { value?: string } = {}
    ): void {
        if (!COLUMN_RATIOS.includes(value)) {
            return;
        }

        const model = this.editor.model;
        const selection = model.document.selection;

        model.change(writer => {
            const content = selection.isCollapsed ? null : model.getSelectedContent(selection);
            const layout = writer.createElement(ELEMENTS.layout, { [RATIOS_ATTRIBUTE]: value });
            const firstColumn = createColumn(writer);
            writer.append(firstColumn, layout);
            setColumnCount(writer, layout, getColumnCount(value));

            model.insertObject(layout);
            if (content) {
                model.insertContent(content, writer.createRangeIn(firstColumn));
            }
            writer.setSelection(firstColumn, "end");
        });
    }
}

/**
 * Sets the column weights of the selected layout. For more columns, empty columns are added at the
 * end. For fewer columns, the last columns are merged into the last remaining one.
 */
export class ColumnLayoutCommand extends Command {

    declare public value: string | undefined;

    public override refresh(): void {
        const layout = getSelectedLayout(this.editor);
        this.isEnabled = !!layout;
        this.value = layout?.getAttribute(RATIOS_ATTRIBUTE) as string | undefined;
    }

    public override execute({ value }: { value: string }): void {
        const layout = getSelectedLayout(this.editor);
        if (!layout || !COLUMN_RATIOS.includes(value)) {
            return;
        }

        this.editor.model.change(writer => {
            setColumnCount(writer, layout, getColumnCount(value));
            writer.setAttribute(RATIOS_ATTRIBUTE, value, layout);
        });
    }
}

/**
 * Replaces the selected layout with the content of its columns, one column after another. Empty
 * columns add nothing, and a layout with only empty columns leaves one empty paragraph.
 */
export class RemoveMulticolumnLayoutCommand extends Command {

    public override refresh(): void {
        this.isEnabled = !!getSelectedLayout(this.editor);
    }

    public override execute(): void {
        const layout = getSelectedLayout(this.editor);
        /* v8 ignore next 3 -- execute() runs only while refresh() keeps the command enabled */
        if (!layout) {
            return;
        }

        this.editor.model.change(writer => {
            const columns = [...layout.getChildren()] as ModelElement[];
            const filled = columns.filter(hasContent);
            for (const column of filled.length ? filled : columns.slice(0, 1)) {
                writer.move(writer.createRangeIn(column), writer.createPositionBefore(layout));
            }
            writer.remove(layout);
        });
    }
}

/**
 * Moves the blocks of the current column that the selection touches to another column of the
 * layout. Content moved toward the first column goes to the end of the target column, and content
 * moved toward the last column goes to its start, so it keeps its place in the reading order.
 */
export class MoveToLayoutColumnCommand extends Command {

    public override refresh(): void {
        this.isEnabled = !!getSelectedColumnContent(this.editor);
    }

    public override execute({ target }: { target: ColumnTarget }): void {
        const content = getSelectedColumnContent(this.editor);
        /* v8 ignore next 3 -- execute() runs only while refresh() keeps the command enabled */
        if (!content) {
            return;
        }
        const { column, first, last } = content;
        const destination = getTargetColumn(column, target);
        if (!destination) {
            return;
        }

        // The ends stick to the moved blocks; one in the block after `last` moves into `last`.
        const model = this.editor.model;
        const after = model.createPositionAfter(last);
        /* v8 ignore next -- `last` holds a place for the selection, or is an object itself */
        const lastEnd = model.schema.getNearestSelectionRange(after, "backward")?.end ?? after;
        const ends = [...model.document.selection.getRanges()].map(range => [
            ModelLivePosition.fromPosition(range.start, "toNext"),
            ModelLivePosition.fromPosition(range.end.isAfter(after) ? lastEnd : range.end,
                "toPrevious")
        ] as const);

        model.change(writer => {
            if (!hasContent(destination)) {
                writer.remove(writer.createRangeIn(destination));
            }
            const moved = writer.createRange(
                writer.createPositionBefore(first), writer.createPositionAfter(last));
            const offset = destination.isAfter(column) ? 0 : "end";
            writer.move(moved, writer.createPositionAt(destination, offset));
            writer.setSelection(ends.map(([start, end]) => writer.createRange(start, end)));
        });

        for (const position of ends.flat()) {
            position.detach();
        }
    }
}

/**
 * Moves the current column to another place in its layout. The column keeps its width where the
 * layout has the widths in their new order, such as `3-1` from `1-3`.
 */
export class MoveLayoutColumnCommand extends Command {

    public override refresh(): void {
        this.isEnabled = !!getSelectedColumn(this.editor);
    }

    public override execute({ target }: { target: ColumnTarget }): void {
        const column = getSelectedColumn(this.editor);
        /* v8 ignore next 3 -- execute() runs only while refresh() keeps the command enabled */
        if (!column) {
            return;
        }
        const sibling = getTargetColumn(column, target);
        if (!sibling) {
            return;
        }

        const layout = column.parent as ModelElement;
        const columns = [...layout.getChildren()];
        const from = columns.indexOf(column);
        const to = columns.indexOf(sibling);
        this.editor.model.change(writer => {
            writer.move(writer.createRangeOn(column), to > from
                ? writer.createPositionAfter(sibling)
                : writer.createPositionBefore(sibling));

            const weights = String(layout.getAttribute(RATIOS_ATTRIBUTE)).split("-");
            weights.splice(to, 0, ...weights.splice(from, 1));
            const ratios = weights.join("-");
            if (COLUMN_RATIOS.includes(ratios)) {
                writer.setAttribute(RATIOS_ATTRIBUTE, ratios, layout);
            }
        });
    }
}

/**
 * Adds an empty column before or after the current one and puts the caret in it. The columns of
 * the layout then have equal widths.
 */
export class InsertLayoutColumnCommand extends Command {

    public override refresh(): void {
        const column = getSelectedColumn(this.editor);
        this.isEnabled = !!column && (column.parent as ModelElement).childCount < MAX_COLUMNS;
    }

    public override execute({ position }: { position: "before" | "after" }): void {
        const column = getSelectedColumn(this.editor);
        /* v8 ignore next 3 -- execute() runs only while refresh() keeps the command enabled */
        if (!column) {
            return;
        }

        const layout = column.parent as ModelElement;
        this.editor.model.change(writer => {
            const added = createColumn(writer);
            writer.insert(added, column, position);
            writer.setAttribute(RATIOS_ATTRIBUTE, getDefaultRatios(layout.childCount), layout);
            writer.setSelection(added, 0);
        });
    }
}

/**
 * Returns the selected layout, or the innermost layout that contains the selection.
 */
export function getSelectedLayout(editor: Editor): ModelElement | null {
    const selection = editor.model.document.selection;
    const selected = selection.getSelectedElement();
    if (selected?.is("element", ELEMENTS.layout)) {
        return selected;
    }
    return selection.getFirstPosition()?.findAncestor(ELEMENTS.layout) ?? null;
}

/** Returns the innermost column that contains the selection. */
export function getSelectedColumn(editor: Editor): ModelElement | null {
    const selection = editor.model.document.selection;
    return selection.getFirstPosition()?.findAncestor(ELEMENTS.column) ?? null;
}

/**
 * Returns the column of a non-collapsed selection and the first and last of its children that the
 * selection touches. A selection that ends at the start of a child leaves that child out.
 */
export function getSelectedColumnContent(editor: Editor) {
    const model = editor.model;
    const selection = model.document.selection;
    const start = selection.getFirstPosition();
    const end = selection.getLastPosition();
    const column = start?.findAncestor(ELEMENTS.column);
    if (selection.isCollapsed || !start || !end || !column
        || end.findAncestor(ELEMENTS.column) !== column) {
        return null;
    }

    const first = getChildAt(column, start, "after");
    let last = getChildAt(column, end, "before");
    if (last && end.parent !== column && end.isTouching(model.createPositionAt(last, 0))) {
        last = last.previousSibling;
    }
    /* v8 ignore next 3 -- a selection that is not collapsed touches a child of the column */
    if (!first || !last) {
        return null;
    }
    return { column, first, last };
}

/**
 * Returns the column of the layout of `column` that `target` names, or `null` when that is `column`
 * itself or there is no such column.
 */
function getTargetColumn(column: ModelElement, target: ColumnTarget): ModelElement | null {
    const columns = [...(column.parent as ModelElement).getChildren()] as ModelElement[];
    const index = columns.indexOf(column);
    const last = columns.length - 1;
    const found = columns[{ previous: index - 1, next: index + 1, first: 0, last }[target]];
    return found && found !== column ? found : null;
}

/**
 * Returns the child of `column` that holds `position`, or the node on `side` of `position` when it
 * is directly in `column`.
 */
function getChildAt(column: ModelElement, position: ModelPosition, side: "before" | "after") {
    if (position.parent === column) {
        return side === "after" ? position.nodeAfter : position.nodeBefore;
    }
    return position.getAncestors().find((ancestor): ancestor is ModelElement =>
        ancestor.is("element") && ancestor.parent === column);
}

/**
 * Appends empty columns to `layout`, or merges its last columns into the column before them, until
 * it has `count` columns.
 */
export function setColumnCount(writer: ModelWriter, layout: ModelElement, count: number) {
    while (layout.childCount < count) {
        writer.append(createColumn(writer), layout);
    }
    while (layout.childCount > count) {
        const last = layout.getChild(layout.childCount - 1) as ModelElement;
        mergeColumn(writer, last, last.previousSibling as ModelElement);
    }
}

function createColumn(writer: ModelWriter): ModelElement {
    const column = writer.createElement(ELEMENTS.column);
    writer.appendElement("paragraph", column);
    return column;
}

/**
 * Moves the content of `from` to the end of `to` and removes `from`. A column with only an empty
 * paragraph that is not a list item counts as empty, so a merge adds no blank line.
 */
function mergeColumn(writer: ModelWriter, from: ModelElement, to: ModelElement) {
    if (hasContent(from)) {
        const placeholder = hasContent(to) ? null : to.getChild(0);
        writer.move(writer.createRangeIn(from), writer.createPositionAt(to, "end"));
        if (placeholder) {
            writer.remove(placeholder);
        }
    }
    writer.remove(from);
}

/** Whether `column` holds more than the empty paragraph that a new column starts with. */
function hasContent(column: ModelElement) {
    const first = column.getChild(0);
    if (!first) {
        return false;
    }
    return column.childCount > 1
        || !first.is("element", "paragraph")
        || !first.isEmpty
        || first.hasAttribute("listItemId");
}
