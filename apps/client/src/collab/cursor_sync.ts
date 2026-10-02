import type { GuestEditor } from "@triliumnext/ckeditor5";
import type CodeMirror from "@triliumnext/codemirror";
import { getLocalCodeSelection, setRemoteCursors } from "@triliumnext/codemirror";
import type {
    CollabCursorOwner, CollabPerson, CollabSelection, WebSocketMessage
} from "@triliumnext/commons";

/** How long a moved caret waits before it is sent, so a burst of keys sends it once. */
const SEND_DELAY_MS = 100;

/** Another person's selection, as the sync hands it to an editor to draw. */
export interface RemoteSelection extends CollabCursorOwner {
    selection: CollabSelection;
}

/** What the sync needs of an editor: its own selection, and a place to draw the others'. */
export interface CursorAdapter {
    /** The editor's selection, or null while the editor does not have the focus. */
    read(): CollabSelection | null;
    draw(selections: RemoteSelection[]): void;
    /** Calls the listener whenever the selection or the focus might have changed. */
    listen(listener: () => void): () => void;
}

export type RemoteCursorMessage = Extract<WebSocketMessage, { type: "collab-remote-cursor" }>;
type CursorMessage = Extract<WebSocketMessage, { type: "collab-cursor" }>;

export interface CursorSync {
    /** Draws a selection another person sent, when it is on this editor's note. */
    receive(message: RemoteCursorMessage): void;
    /** Who is where now, from the collaboration's presence. */
    setPeople(people: readonly CollabPerson[]): void;
    /** Moves the sync to the note the editor shows next. */
    setNoteId(noteId: string): void;
    dispose(): void;
}

export interface CursorSyncOptions {
    noteId: string;
    /** The person this editor belongs to, whose own selections arriving back are ignored. */
    selfId: string;
    adapter: CursorAdapter;
    send(message: CursorMessage): void;
}

/**
 * Shares an editor's selection with the others on its note and draws theirs. It sends at most once
 * every {@link SEND_DELAY_MS}, only while someone else is on the note, and again whenever someone
 * arrives there; it drops the selections of people who left the note.
 */
export function createCursorSync({ noteId, selfId, adapter, send }: CursorSyncOptions): CursorSync {
    let currentNoteId = noteId;
    let people: readonly CollabPerson[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSent: string | undefined;
    const remote = new Map<string, RemoteSelection>();

    const othersHere = () => people
        .filter((person) => person.id !== selfId && person.noteId === currentNoteId)
        .map((person) => person.id);
    const redraw = () => adapter.draw([ ...remote.values() ]);
    const flush = () => {
        timer = undefined;

        if (othersHere().length === 0) {
            return;
        }

        const selection = adapter.read();
        const sending = JSON.stringify(selection);

        if (sending !== lastSent) {
            lastSent = sending;
            send({ type: "collab-cursor", noteId: currentNoteId, selection });
        }
    };
    const schedule = () => {
        timer ??= setTimeout(flush, SEND_DELAY_MS);
    };
    const stopListening = adapter.listen(schedule);

    return {
        receive(message) {
            if (message.noteId !== currentNoteId || message.person.id === selfId) {
                return;
            }

            if (message.selection) {
                remote.set(message.person.id, { ...message.person, selection: message.selection });
            } else {
                remote.delete(message.person.id);
            }

            redraw();
        },
        setPeople(next) {
            const before = new Set(othersHere());
            let changed = false;
            people = next;

            for (const [ id, entry ] of remote) {
                const person = next.find((candidate) => candidate.id === id);

                if (!person || person.noteId !== currentNoteId) {
                    remote.delete(id);
                    changed = true;
                } else if (person.name !== entry.name || person.color !== entry.color) {
                    remote.set(id, { ...entry, name: person.name, color: person.color });
                    changed = true;
                }
            }

            if (changed) {
                redraw();
            }

            if (othersHere().some((id) => !before.has(id))) {
                lastSent = undefined;
                schedule();
            }
        },
        setNoteId(next) {
            if (next === currentNoteId) {
                return;
            }

            currentNoteId = next;
            remote.clear();
            redraw();
            lastSent = undefined;
            schedule();
        },
        dispose() {
            clearTimeout(timer);
            stopListening();
            remote.clear();
            redraw();
        }
    };
}

/** Reads and draws selections in a text note's editor, through its `CollabCursors` plugin. */
export function textCursorAdapter(
    editor: Pick<GuestEditor, "plugins" | "model" | "editing">
): CursorAdapter {
    const cursors = editor.plugins.get("CollabCursors");
    const { document } = editor.model;
    const viewDocument = editor.editing.view.document;

    return {
        read: () => {
            const selection = viewDocument.isFocused ? cursors.getLocalSelection() : null;

            return selection && { kind: "text", ...selection };
        },
        draw: (selections) => cursors.setRemoteCursors(
            selections.flatMap(({ selection, ...person }) =>
                (selection.kind === "text" ? [ { ...person, ...selection } ] : []))),
        listen: (listener) => {
            document.selection.on("change:range", listener);
            document.on("change:data", listener);
            viewDocument.on("change:isFocused", listener);

            return () => {
                document.selection.off("change:range", listener);
                document.off("change:data", listener);
                viewDocument.off("change:isFocused", listener);
            };
        }
    };
}

/** Reads and draws selections in a code editor. */
export function codeCursorAdapter(view: CodeMirror): CursorAdapter {
    return {
        read: () => (view.hasFocus ? { kind: "code", ...getLocalCodeSelection(view) } : null),
        draw: (selections) => setRemoteCursors(view,
            selections.flatMap(({ selection, ...person }) =>
                (selection.kind === "code" ? [ { ...person, ...selection } ] : []))),
        listen: (listener) => view.addUpdateListener((update) => {
            if (update.selectionSet || update.docChanged || update.focusChanged) {
                listener();
            }
        })
    };
}
