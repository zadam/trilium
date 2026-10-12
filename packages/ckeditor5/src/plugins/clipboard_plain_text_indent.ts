import { ClipboardPipeline, Plugin, UpcastWriter, viewToPlainText } from "ckeditor5";
import type { Editor, EditingView, ViewDocumentClipboardOutputEvent, ViewDocumentFragment, ViewElement, ViewNode } from "ckeditor5";

/** The blocks that `IndentBlock` indents with a margin. */
const INDENTABLE_BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6"]);

/**
 * Keeps block indentation in the `text/plain` clipboard flavor.
 *
 * `IndentBlock` stores an indent as a `margin-left` style, which CKEditor's `viewToPlainText()`
 * drops, so text pasted into a code note or another application loses it. The plugin rewrites the
 * `text/plain` flavor with one tab per indent level at the start of each line of an indented block.
 * The `text/html` flavor keeps the margin and is left as it is.
 */
export default class ClipboardPlainTextIndent extends Plugin {

    static get requires() {
        return [ClipboardPipeline] as const;
    }

    static get pluginName() {
        return "ClipboardPlainTextIndent" as const;
    }

    init() {
        // `lowest`, so that the text replaces the one `ClipboardPipeline` sets at `low`.
        this.listenTo<ViewDocumentClipboardOutputEvent>(
            this.editor.editing.view.document,
            "clipboardOutput",
            (_evt, data) => {
                if (!data.content.isEmpty) {
                    data.dataTransfer.setData("text/plain", viewToIndentedPlainText(this.editor, data.content));
                }
            },
            { priority: "lowest" }
        );
    }
}

/**
 * Serializes `fragment` to plain text as `viewToPlainText()` does, with each line of an indented
 * block prefixed by one tab per indent level. The fragment is unchanged afterwards.
 */
export function viewToIndentedPlainText(editor: Editor, fragment: ViewDocumentFragment): string {
    const view = editor.editing.view;
    const writer = new UpcastWriter(view.document);
    const offset = indentOffset(editor);

    const insertions: { parent: ViewElement; index: number; tabs: string }[] = [];
    for (const { item } of view.createRangeIn(fragment)) {
        if (!item.is("element") || !INDENTABLE_BLOCKS.has(item.name)) {
            continue;
        }

        const level = indentLevel(item, offset);
        if (!level) {
            continue;
        }

        const tabs = "\t".repeat(level);
        insertions.push({ parent: item, index: 0, tabs });
        for (const { item: inner } of view.createRangeIn(item)) {
            if (inner.is("element", "br") && inner.parent?.is("element") && inner.index !== null
                && !isLastInBlock(view, inner, item)) {
                insertions.push({ parent: inner.parent, index: inner.index + 1, tabs });
            }
        }
    }

    // Inserting from the last position backwards keeps the earlier indexes valid.
    const inserted: ViewNode[] = [];
    for (const { parent, index, tabs } of insertions.reverse()) {
        const text = writer.createText(tabs);
        writer.insertChild(index, text, parent);
        inserted.push(text);
    }

    try {
        return viewToPlainText(editor.data.htmlProcessor.domConverter, fragment);
    } finally {
        for (const text of inserted) {
            writer.remove(text);
        }
    }
}

/** The width of one indent level, from the `indentBlock` config `IndentBlock` defaults to `40px`. */
function indentOffset(editor: Editor) {
    const config = editor.config.get("indentBlock");
    return { value: config?.offset ?? 40, unit: config?.unit ?? "px" };
}

/**
 * The number of indent levels of `block`. A margin in another unit than the configured one, such as
 * one pasted from a word processor, counts as one level.
 */
function indentLevel(block: ViewElement, offset: { value: number; unit: string }) {
    const margin = block.getStyle("margin-left") ?? block.getStyle("margin-right");
    const match = margin?.trim().match(/^(\d*\.?\d+)([a-z%]*)$/i);
    if (!match) {
        return 0;
    }

    const value = Number(match[1]);
    if (value <= 0) {
        return 0;
    }

    return match[2] === offset.unit ? Math.max(1, Math.round(value / offset.value)) : 1;
}

/** Whether nothing follows `node` inside `block`, so a line break there starts no new line of text. */
function isLastInBlock(view: EditingView, node: ViewNode, block: ViewElement) {
    const rest = view.createRange(view.createPositionAfter(node), view.createPositionAt(block, "end"));
    return rest.getItems().next().done === true;
}
