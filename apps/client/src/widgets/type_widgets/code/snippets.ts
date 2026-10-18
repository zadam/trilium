import { isMarkdownMime } from "@triliumnext/commons";
import { useCallback, useEffect, useRef } from "preact/hooks";

import type FNote from "../../../entities/fnote.js";
import type LoadResults from "../../../services/load_results.js";
import search from "../../../services/search.js";
import { logError } from "../../../services/ws.js";
import { useTriliumEvent } from "../../react/hooks";

/** Matches a `/command` token at the start of a line or after whitespace. Shared by every editor. */
export const SLASH_COMMAND_REGEX = /(?:^|(?<=\s))\/[\w:-]*/;

export interface CodeSnippet {
    noteId: string;
    title: string;
    description?: string;
    content: string;
}

/**
 * Loads the code snippets (notes carrying `#snippet`) accepted by `matches`, pre-fetching their
 * content and optional `#snippetDescription` so callers can insert them synchronously. The `matches`
 * predicate selects which snippets are relevant to a given editor (e.g. `note.isMarkdown()` for the
 * Markdown editor, or a MIME comparison for a code editor).
 */
export async function getCodeSnippets(matches: (note: FNote) => boolean): Promise<CodeSnippet[]> {
    try {
        // The `search` route includes archived notes, so drop archived ones; also skip protected
        // snippets whose content isn't available (no active protected session) — they can't be inserted.
        const notes = (await searchSnippetNotes())
            .filter((note) => matches(note) && !note.isArchived && note.isContentAvailable());

        return await Promise.all(notes.map(async (note) => ({
            noteId: note.noteId,
            title: note.title,
            description: note.getLabelValue("snippetDescription") ?? undefined,
            content: (await note.getContent()) ?? ""
        })));
    } catch (e) {
        logError(`Error while building code snippets: ${e}`);
        return [];
    }
}

/** The `#snippet` notes. Editors that load them at the same time share one search. */
function searchSnippetNotes() {
    pendingSearch ??= search.searchForNotes("#snippet").finally(() => {
        pendingSearch = null;
    });
    return pendingSearch;
}

let pendingSearch: Promise<FNote[]> | null = null;

/**
 * Whether the reloaded entities could change the snippet list — a snippet was created, deleted,
 * retitled, had its description changed, or its content edited. `knownNoteIds` are the note IDs of
 * the snippets currently held by the caller, used to detect content/title edits.
 */
export function isCodeSnippetChange(loadResults: LoadResults, knownNoteIds: Set<string>): boolean {
    const attributeChanged = loadResults.getAttributeRows().some((attr) => {
        if (attr.type === "label") {
            return attr.name === "snippet" || attr.name === "snippetDescription";
        }
        if (attr.type === "relation") {
            return attr.value === "_template_markdown_snippet" || attr.value === "_template_code_snippet";
        }
        return false;
    });

    return attributeChanged || loadResults.getNoteIds().some((noteId) => knownNoteIds.has(noteId));
}

/**
 * Whether the snippet note `candidate` can be inserted into content of `mime`: a code note of the
 * same language, of any Markdown MIME type for Markdown, or of plain text.
 */
export function isSnippetFor(candidate: FNote, mime: string) {
    if (candidate.type !== "code") return false;
    if (candidate.mime === "text/plain") return true;
    return isMarkdownMime(mime) ? candidate.isMarkdown() : candidate.mime === mime;
}

/**
 * Loads the snippets for content of `mime` into a ref and keeps it fresh: reloaded on mount, when
 * `mime` changes, and when relevant entities change. Held in a ref so a `/` list reads the latest
 * list when it opens, without registering anything again. Nothing loads while `isEnabled` is false.
 */
export function useCodeSnippets(mime: string, isEnabled = true) {
    const snippetsRef = useRef<CodeSnippet[]>([]);
    // Monotonic id so a slow fetch that resolves after a newer reload is discarded (avoids stale data).
    const reloadCountRef = useRef(0);

    const reload = useCallback(() => {
        const reloadId = ++reloadCountRef.current;
        if (!isEnabled) {
            snippetsRef.current = [];
            return;
        }
        void getCodeSnippets((note) => isSnippetFor(note, mime)).then((snippets) => {
            if (reloadId === reloadCountRef.current) {
                snippetsRef.current = snippets;
            }
        });
    }, [isEnabled, mime]);

    useEffect(() => { reload(); }, [reload]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (!isEnabled) return;
        const knownNoteIds = new Set(snippetsRef.current.map((snippet) => snippet.noteId));
        if (isCodeSnippetChange(loadResults, knownNoteIds)) {
            reload();
        }
    });

    return snippetsRef;
}