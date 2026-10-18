import type VanillaCodeMirror from "@triliumnext/codemirror";
import {
    hostedCompletion, type HostedCompletionApply, type HostedCompletionState
} from "@triliumnext/codemirror/src/extensions/hosted_completion";
import { isMarkdownMime, type TaskStateDef } from "@triliumnext/commons";
import { useEffect, useRef } from "preact/hooks";

import type FNote from "../../../entities/fnote";
import { getTaskStateDefinitions } from "../../../services/task_states";
import {
    type CommandEntry, CommandMentionList, createHostedList, filterCommandEntries, NoteMentionList
} from "../../react/NoteAutocomplete";
import {
    buildMarkdownCommands, codeFenceCompletionSource, linkToNote, markdownCompletionAt
} from "../markdown/completions";
import { type CodeSnippet, SLASH_COMMAND_REGEX, useCodeSnippets } from "./snippets";

/** A `/` command of a code editor, listed as the text editor lists its own. */
export interface SlashCommand extends CommandEntry {
    /** Runs the command on the typed `/command`, from `from` to the caret at `to`. */
    apply: HostedCompletionApply;
}

/** A `/command` or a note typed before the caret, from its `/`, its `@` or its `[[`. */
export interface CompletionMatch {
    kind: "command" | "note";
    from: number;
    /** What follows the `/`, the `@` or the `[[`, which the list filters by. */
    query: string;
}

/** The content that a code editor completes. */
export interface CompletionTarget {
    /** The note being edited, which its own `/` list leaves out, or `null` for other content. */
    note: FNote | null;
    /** The note that images upload to and new notes go under. `note` by default. */
    ownerNote?: FNote | null;
    /** The path that new notes go under. The best path of the owner note by default. */
    getNotePath?(): string | null | undefined;
}

/**
 * Registers the `/` list of `view`, drawn as the text editor's: the code snippets for `mime`, and
 * for Markdown its commands, the notes typed after `@` or `[[`, and the code-fence languages.
 * Nothing registers while `target` is `undefined`.
 */
export function useEditorCompletions(
    view: VanillaCodeMirror | null,
    mime: string,
    target: CompletionTarget | undefined
) {
    const isEnabled = target !== undefined;
    const isMarkdown = isMarkdownMime(mime);
    // Read when the list opens, as switching notes reuses the editor.
    const targetRef = useRef(target);
    targetRef.current = target;
    const snippetsRef = useCodeSnippets(mime, isEnabled);
    const taskStatesRef = useRef<TaskStateDef[]>([]);

    useEffect(() => {
        if (!isEnabled || !isMarkdown) return;
        void getTaskStateDefinitions().then((states) => { taskStatesRef.current = states; });
    }, [ isEnabled, isMarkdown ]);

    useEffect(() => {
        if (!view || !isEnabled) return;

        const getOwnerNote = () => targetRef.current?.ownerNote ?? targetRef.current?.note ?? null;
        const getNotePath = () => (
            targetRef.current?.getNotePath?.() ?? getOwnerNote()?.getBestNotePathString()
        );
        const commands = (): SlashCommand[] => [
            ...(isMarkdown ? buildMarkdownCommands({
                editorView: view, getOwnerNote, taskStates: taskStatesRef.current
            }) : []),
            ...snippetsRef.current
                .filter((snippet) => snippet.noteId !== targetRef.current?.note?.noteId)
                .map(snippetCommand)
        ];
        const codeCommandAt = (before: string): CompletionMatch | null => {
            const typed = COMMAND_TYPED.exec(before);
            if (!typed || commands().length === 0) return null;
            return { kind: "command", from: typed.index, query: typed[0].slice(1) };
        };
        const match: typeof markdownCompletionAt = isMarkdown
            ? markdownCompletionAt
            : codeCommandAt;

        // Bridges the codemirror package's own @codemirror/state identity.
        type CmMatcher = Parameters<typeof hostedCompletion<CompletionMatch>>[0]["match"];
        view.setNamedExtension("slashCommands", hostedCompletion({
            match: match as unknown as CmMatcher,
            list: () => createCompletionList(commands, getNotePath)
        }));
        if (!isMarkdown) {
            return () => view.setNamedExtension("slashCommands", []);
        }

        // CodeMirror allows one `override` config per editor, so the fence languages go through
        // `setCompletionSource()`. Bridges the package's own @codemirror/autocomplete identity.
        type CmCompletionSource = Parameters<VanillaCodeMirror["setCompletionSource"]>[1];
        view.setCompletionSource(
            "markdownCodeFence", codeFenceCompletionSource as unknown as CmCompletionSource
        );
        return () => {
            view.setNamedExtension("slashCommands", []);
            view.setCompletionSource("markdownCodeFence", null);
        };
    }, [ view, isEnabled, isMarkdown ]);
}

const COMMAND_TYPED = new RegExp(`${SLASH_COMMAND_REGEX.source}$`);

/** The entry of `snippet` in the `/` list, which puts its content in place of the typed command. */
export function snippetCommand(snippet: CodeSnippet): SlashCommand {
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

/**
 * The `/` list or the `@` list, drawn as the text editor's: the first runs the command picked on
 * the typed `/command`, the second puts a link to the note picked or created in place of the typed
 * note. A note created goes under `getNotePath()`.
 */
function createCompletionList(
    commands: () => SlashCommand[],
    getNotePath: () => string | null | undefined
) {
    return createHostedList<HostedCompletionState<CompletionMatch>>((state, list) => {
        const { kind, from, query } = state.match;
        if (kind === "note") {
            return (
                <NoteMentionList
                    key={`note:${from}`}
                    {...list}
                    query={query}
                    allowCreatingNotes
                    parentNotePath={getNotePath()}
                    onPick={(notePath) => state.commit(typeof notePath === "string"
                        ? linkToNote(notePath)
                        : notePath.then((path) => path ? linkToNote(path) : undefined))}
                />
            );
        }

        return (
            <CommandMentionList<SlashCommand>
                key={`command:${from}`}
                {...list}
                query={query}
                source={async (typed) => filterCommandEntries(commands(), typed)}
                className="slash-command-menu"
                onPick={(entry) => state.commit(entry.apply)}
            />
        );
    });
}
