import type { DifferItemAttribute, Editor, ModelDocumentFragment, ModelElement, ModelNode } from "ckeditor5";

export function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hasHeadingAncestor(node: ModelElement | ModelNode | ModelDocumentFragment | null): boolean {
    let current: ModelElement | ModelNode | ModelDocumentFragment | null = node;
    while (current) {
        if (!!current && current.is('element') && (current as ModelElement).name.startsWith("heading")) return true;
        current = current.parent;
    }
    return false;
}

export function attributeChangeAffectsHeading(change: DifferItemAttribute, editor: Editor): boolean {
    if (change.type !== "attribute") return false;

    // Fast checks on range boundaries
    if (hasHeadingAncestor(change.range.start.parent) || hasHeadingAncestor(change.range.end.parent)) {
        return true;
    }

    // Robust check across the whole changed range
    const range = editor.model.createRange(change.range.start, change.range.end);
    for (const item of range.getItems()) {
        const baseNode = item.is("$textProxy") ? item.parent : item;
        if (hasHeadingAncestor(baseNode)) return true;
    }

    return false;
}

/**
 * Inserts an empty paragraph at the very top of the document and places the cursor in it, giving
 * the Notion-like behavior when pressing Enter in the note title. If the first block is already an
 * empty paragraph, the cursor is placed in it rather than stacking another empty paragraph.
 */
export function placeCursorInNewTopParagraph(editor: Editor) {
    editor.model.change((writer) => {
        const root = editor.model.document.getRoot();
        if (!root) return;

        const firstChild = root.getChild(0);
        if (firstChild?.is("element", "paragraph") && firstChild.isEmpty) {
            writer.setSelection(firstChild, "in");
            return;
        }

        const paragraph = writer.createElement("paragraph");
        writer.insert(paragraph, root, 0);
        writer.setSelection(paragraph, "in");
    });

    // The scrolling container scrolls, not the editor itself, and the inline title may have
    // scrolled out of view (e.g. the cursor was at the bottom of a long note), so the selection
    // change alone won't move the viewport. Explicitly reveal the new top paragraph once it has
    // rendered.
    requestAnimationFrame(() => {
        // The editor may have been destroyed while waiting for the frame (e.g. the user navigated
        // away from the note), in which case `editing` is nulled — bail out instead of throwing.
        if (editor.editing?.view) {
            editor.editing.view.scrollToTheSelection();
        }
    });
}
