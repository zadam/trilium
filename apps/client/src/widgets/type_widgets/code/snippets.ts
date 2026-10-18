import type {
    HostedCompletionApply
} from "@triliumnext/codemirror/src/extensions/hosted_completion";
import { useCallback, useEffect, useRef } from "preact/hooks";

import type FNote from "../../../entities/fnote.js";
import type LoadResults from "../../../services/load_results.js";
import search from "../../../services/search.js";
import { useTriliumEvent } from "../../react/hooks";
import type { CommandEntry } from "../../react/NoteAutocomplete";

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
        const notes = (await search.searchForNotes("#snippet"))
            .filter((note) => matches(note) && !note.isArchived && note.isContentAvailable());

        return await Promise.all(notes.map(async (note) => ({
            noteId: note.noteId,
            title: note.title,
            description: note.getLabelValue("snippetDescription") ?? undefined,
            content: (await note.getContent()) ?? ""
        })));
    } catch (e) {
        logError("Error while building code snippets: ", e);
        return [];
    }
}

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
 * A snippet as an entry of a `/` list, found by its title or by `snippet:<title>`. Picking it puts
 * the snippet's content in place of the typed `/command` and moves the caret to its end.
 */
export function snippetCommand(snippet: CodeSnippet): SnippetCommand {
    const name = `snippet:${snippet.title}`;

    return {
        id: name,
        title: snippet.title,
        description: snippet.description,
        aliases: [ name, "snippet", "template" ],
        icon: "bx bx-code-curly",
        apply(view, from, to) {
            view.dispatch({
                changes: { from, to, insert: snippet.content },
                selection: { anchor: from + snippet.content.length }
            });
        }
    };
}

export type SnippetCommand = CommandEntry & { apply: HostedCompletionApply };

/**
 * Loads the snippets accepted by `matches` into a ref and keeps it fresh: reloaded on mount, when
 * `reloadKey` changes (e.g. the editor note's MIME), and when relevant entities change. Held in a
 * ref so consumers (a slash menu) read the latest list when invoked, without re-registering anything.
 * When `enabled` is false the ref stays empty and nothing is loaded.
 */
export function useCodeSnippets(matches: (note: FNote) => boolean, reloadKey: string, enabled = true) {
    const snippetsRef = useRef<CodeSnippet[]>([]);
    // Monotonic id so a slow fetch that resolves after a newer reload is discarded (avoids stale data).
    const reloadCountRef = useRef(0);
    // Keep the latest predicate without making it a dependency (it's a fresh closure each render);
    // `reloadKey` is the stable trigger for filter changes.
    const matchesRef = useRef(matches);
    useEffect(() => { matchesRef.current = matches; });

    const reload = useCallback(() => {
        if (!enabled) {
            snippetsRef.current = [];
            return;
        }
        const reloadId = ++reloadCountRef.current;
        void getCodeSnippets((note) => matchesRef.current(note)).then((snippets) => {
            if (reloadId === reloadCountRef.current) {
                snippetsRef.current = snippets;
            }
        });
    }, [enabled]);

    useEffect(() => { reload(); }, [reload, reloadKey]);

    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (!enabled) return;
        const knownNoteIds = new Set(snippetsRef.current.map((snippet) => snippet.noteId));
        if (isCodeSnippetChange(loadResults, knownNoteIds)) {
            reload();
        }
    });

    return snippetsRef;
}
