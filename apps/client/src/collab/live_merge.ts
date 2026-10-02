import type { GuestEditor } from "@triliumnext/ckeditor5";
import type CodeMirror from "@triliumnext/codemirror";
import { applyRemoteChanges } from "@triliumnext/codemirror";
import { diffChars } from "diff";

/** A replacement of the text between two offsets of the text before any of the changes. */
export interface TextChange {
    from: number;
    to: number;
    insert: string;
}

/** How long a diff can run before it describes the whole changed span as one replacement. */
const DIFF_TIMEOUT_MS = 100;

/**
 * Merges two people's edits of the same text: `mine` and `theirs` each started from `base`.
 * Edits in different places are both kept; where both typed at the same place, the other
 * person's text comes first; overlapping deletions join. Returns null when both changed the same
 * text differently, which only one of them can win.
 */
export function mergeText(base: string, mine: string, theirs: string): string | null {
    if (mine === theirs || base === theirs) {
        return mine;
    }

    if (base === mine) {
        return theirs;
    }

    const changes = [
        ...textChanges(base, theirs).map((change) => ({ ...change, mine: false })),
        ...textChanges(base, mine).map((change) => ({ ...change, mine: true }))
    ].sort((a, b) => a.from - b.from
        || Number(a.to > a.from) - Number(b.to > b.from)
        || Number(a.mine) - Number(b.mine));
    const merged: TextChange[] = [];

    for (const change of changes) {
        const last = merged.at(-1);

        if (last && last.from === change.from && last.to === change.to
            && last.insert === change.insert) {
            continue;
        }

        if (last && change.from < last.to) {
            if (last.insert || change.insert) {
                return null;
            }

            last.to = Math.max(last.to, change.to);
            continue;
        }

        merged.push({ from: change.from, to: change.to, insert: change.insert });
    }

    return applyTextChanges(base, merged);
}

/**
 * Merges another person's version of a text note with a CKEditor's own edits, as
 * `EditorHandle.merge` describes. `asRemote` runs the change so the editor does not save it.
 */
export function mergeTextEditor(
    editor: Pick<GuestEditor, "data" | "getData" | "plugins">, base: string, theirs: string,
    asRemote: (apply: () => void) => void
): boolean {
    // Markup as this editor writes it, so that only real edits differ from the editor's own.
    const normalize = (html: string) => editor.data.stringify(editor.data.parse(html));
    const mine = editor.getData();
    const merged = mergeText(normalize(base), mine, normalize(theirs));

    if (merged !== null && merged !== mine) {
        asRemote(() => editor.plugins.get("CollabCursors").applyRemoteData(merged));
    }

    return merged !== null;
}

/**
 * Merges another person's version of a code editor's text with its own edits, as
 * `EditorHandle.merge` describes. `asRemote` runs the change so the editor does not save it.
 */
export function mergeCode(
    editor: CodeMirror, base: string, theirs: string, asRemote: (apply: () => void) => void
): boolean {
    const mine = editor.getText();
    const merged = mergeText(base, mine, theirs);

    if (merged !== null && merged !== mine) {
        asRemote(() => applyRemoteChanges(editor, textChanges(mine, merged)));
    }

    return merged !== null;
}

/** The edits that turn `before` into `after`, in order and apart from each other. */
export function textChanges(before: string, after: string): TextChange[] {
    const shorter = Math.min(before.length, after.length);
    let prefix = 0;

    while (prefix < shorter && before[prefix] === after[prefix]) {
        prefix++;
    }

    let suffix = 0;

    while (suffix < shorter - prefix
        && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
        suffix++;
    }

    const end = before.length - suffix;
    const removed = before.slice(prefix, end);
    const inserted = after.slice(prefix, after.length - suffix);

    if (!removed && !inserted) {
        return [];
    }

    const parts = removed && inserted
        ? diffChars(removed, inserted, { timeout: DIFF_TIMEOUT_MS })
        : undefined;

    if (!parts) {
        return [ { from: prefix, to: end, insert: inserted } ];
    }

    const changes: TextChange[] = [];
    let offset = prefix;

    for (const part of parts) {
        if (!part.added && !part.removed) {
            offset += part.value.length;
            continue;
        }

        let last = changes.at(-1);

        if (!last || last.to !== offset) {
            last = { from: offset, to: offset, insert: "" };
            changes.push(last);
        }

        if (part.removed) {
            offset += part.value.length;
            last.to = offset;
        } else {
            last.insert += part.value;
        }
    }

    return changes;
}

/** Applies changes that are in order and apart from each other, as {@link textChanges} gives. */
export function applyTextChanges(text: string, changes: readonly TextChange[]): string {
    let result = "";
    let offset = 0;

    for (const change of changes) {
        result += text.slice(offset, change.from) + change.insert;
        offset = change.to;
    }

    return result + text.slice(offset);
}
