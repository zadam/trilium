import CodeMirror from "@triliumnext/codemirror";
import type { CollabPerson, CollabSelection } from "@triliumnext/commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    codeCursorAdapter, createCursorSync, type CursorAdapter, type RemoteCursorMessage,
    type RemoteSelection, textCursorAdapter
} from "./cursor_sync.js";

const CARET: CollabSelection = { kind: "code", anchor: 1, head: 1 };

function person(id: string, noteId: string | null, name = id): CollabPerson {
    return { id, name, color: "#2066df", isHost: false, noteId, editing: true };
}

function cursorFrom(
    id: string, noteId: string, selection: CollabSelection | null
): RemoteCursorMessage {
    return {
        type: "collab-remote-cursor", collabId: "c1", noteId,
        person: { id, name: id, color: "#2066df" }, selection
    };
}

/** An editor whose selection the test moves, and which keeps what the sync drew. */
function fakeAdapter() {
    let selection: CollabSelection | null = null;
    const listeners = new Set<() => void>();
    const adapter = {
        drawn: [] as RemoteSelection[],
        listeners,
        read: () => selection,
        draw(selections: RemoteSelection[]) {
            adapter.drawn = selections;
        },
        listen(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        move(next: CollabSelection | null) {
            selection = next;
            for (const listener of listeners) listener();
        }
    } satisfies CursorAdapter & Record<string, unknown>;
    return adapter;
}

describe("createCursorSync", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function start(adapter = fakeAdapter()) {
        const sent: unknown[] = [];
        const sync = createCursorSync({
            noteId: "n1", selfId: "me", adapter, send: (message) => sent.push(message)
        });
        return { sync, sent, adapter };
    }

    it("sends the selection to the others on the note, once a burst ends and only when it moved",
        () => {
            const { sync, sent, adapter } = start();
            const at = (offset: number): CollabSelection =>
                ({ kind: "code", anchor: offset, head: offset });

            // Alone on the note, nothing goes out.
            adapter.move(at(1));
            vi.advanceTimersByTime(500);
            expect(sent).toEqual([]);

            // Someone arriving gets the selection.
            sync.setPeople([ person("me", "n1"), person("p2", "n1") ]);
            vi.advanceTimersByTime(100);
            expect(sent).toEqual([ { type: "collab-cursor", noteId: "n1", selection: at(1) } ]);

            adapter.move(at(2));
            adapter.move(at(3));
            vi.advanceTimersByTime(99);
            expect(sent).toHaveLength(1);
            vi.advanceTimersByTime(1);
            expect(sent).toEqual([
                { type: "collab-cursor", noteId: "n1", selection: at(1) },
                { type: "collab-cursor", noteId: "n1", selection: at(3) }
            ]);

            // A selection that did not move stays unsent, until someone else arrives.
            adapter.move(at(3));
            vi.advanceTimersByTime(100);
            expect(sent).toHaveLength(2);
            sync.setPeople([ person("me", "n1"), person("p2", "n1"), person("p3", "n1") ]);
            vi.advanceTimersByTime(100);
            expect(sent).toHaveLength(3);

            // People who leave, or are on another note, are no reason to send.
            sync.setPeople([ person("me", "n1"), person("p2", "n2") ]);
            adapter.move(at(4));
            vi.advanceTimersByTime(100);
            expect(sent).toHaveLength(3);
        });

    it("draws the others' selections on its note, renamed with the list, until they leave it",
        () => {
            const { sync, adapter } = start();
            sync.setPeople([ person("p2", "n1"), person("p3", "n2") ]);

            sync.receive(cursorFrom("p2", "n1", CARET));
            sync.receive(cursorFrom("p3", "n2", CARET));
            sync.receive(cursorFrom("me", "n1", CARET));
            expect(adapter.drawn).toEqual([
                { id: "p2", name: "p2", color: "#2066df", selection: CARET }
            ]);

            sync.setPeople([ person("p2", "n1", "Grace") ]);
            expect(adapter.drawn.map((entry) => entry.name)).toEqual([ "Grace" ]);

            // Someone who left the note leaves no caret behind, nor does one sending none.
            sync.setPeople([ person("p2", "n3", "Grace") ]);
            expect(adapter.drawn).toEqual([]);
            sync.receive(cursorFrom("p4", "n1", CARET));
            sync.receive(cursorFrom("p4", "n1", null));
            expect(adapter.drawn).toEqual([]);

            // An unchanged list leaves the drawing alone.
            const draw = vi.spyOn(adapter, "draw");
            sync.setPeople([ person("p2", "n3", "Grace") ]);
            expect(draw).not.toHaveBeenCalled();
        });

    it("follows the editor to its next note and stops on dispose", () => {
        const { sync, sent, adapter } = start();
        sync.setPeople([ person("p2", "n1"), person("p3", "n2") ]);
        sync.receive(cursorFrom("p2", "n1", CARET));
        adapter.move(CARET);
        vi.advanceTimersByTime(100);
        expect(sent).toHaveLength(1);

        sync.setNoteId("n1");
        expect(adapter.drawn).toHaveLength(1);

        sync.setNoteId("n2");
        expect(adapter.drawn).toEqual([]);
        vi.advanceTimersByTime(100);
        expect(sent.at(-1)).toEqual({ type: "collab-cursor", noteId: "n2", selection: CARET });

        sync.receive(cursorFrom("p3", "n2", CARET));
        sync.dispose();
        expect(adapter.drawn).toEqual([]);
        expect(adapter.listeners.size).toBe(0);
    });
});

describe("cursor adapters", () => {
    it("reads and draws code selections in CodeMirror, leaving text ones out", () => {
        const parent = document.createElement("div");
        document.body.append(parent);
        const view = new CodeMirror({ parent });
        view.setText("hello world");
        const adapter = codeCursorAdapter(view);
        const listener = vi.fn();
        const stop = adapter.listen(listener);
        // happy-dom answers a real focus with a selection change inside CodeMirror's update.
        let focused = false;
        Object.defineProperty(view, "hasFocus", { get: () => focused });

        // A selection is only the guest's to share while their editor has the focus.
        view.dispatch({ selection: { anchor: 2, head: 7 } });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(adapter.read()).toBeNull();
        focused = true;
        // The next update notices the focus, which is news to send.
        view.dispatch({});
        expect(listener).toHaveBeenCalledTimes(2);
        expect(adapter.read()).toEqual({ kind: "code", anchor: 2, head: 7 });
        const heard = listener.mock.calls.length;

        adapter.draw([
            {
                id: "p2", name: "Grace", color: "#2066df",
                selection: { kind: "code", anchor: 6, head: 6 }
            },
            {
                id: "p3", name: "Alan", color: "#d22a1e",
                selection: { kind: "text", anchor: [ 0 ], head: [ 0 ] }
            }
        ]);
        expect([ ...view.contentDOM.querySelectorAll(".cm-collab-caret") ]
            .map((caret) => caret.textContent)).toEqual([ "Grace" ]);
        // Drawing changes neither the text nor the selection, so it tells nobody to send.
        expect(listener).toHaveBeenCalledTimes(heard);

        stop();
        view.dispatch({ selection: { anchor: 1 } });
        expect(listener).toHaveBeenCalledTimes(heard);
        view.destroy();
        parent.remove();
    });

    it("reads and draws text selections through the editor's CollabCursors plugin", () => {
        const plugin = {
            getLocalSelection: vi.fn(() => ({ anchor: [ 0, 1 ], head: [ 0, 4 ] })),
            setRemoteCursors: vi.fn()
        };
        const emitter = () => {
            const listeners = new Map<string, () => void>();
            return {
                listeners,
                on: (event: string, listener: () => void) => listeners.set(event, listener),
                off: (event: string) => listeners.delete(event)
            };
        };
        const selection = emitter();
        const document = { ...emitter(), selection };
        const viewDocument = { ...emitter(), isFocused: false };
        const editor = {
            plugins: { get: () => plugin },
            model: { document },
            editing: { view: { document: viewDocument } }
        };
        const adapter = textCursorAdapter(
            editor as unknown as Parameters<typeof textCursorAdapter>[0]);

        expect(adapter.read()).toBeNull();
        viewDocument.isFocused = true;
        expect(adapter.read()).toEqual({ kind: "text", anchor: [ 0, 1 ], head: [ 0, 4 ] });
        plugin.getLocalSelection.mockReturnValueOnce(null as never);
        expect(adapter.read()).toBeNull();

        adapter.draw([
            {
                id: "p2", name: "Grace", color: "#2066df",
                selection: { kind: "text", anchor: [ 0, 2 ], head: [ 0, 2 ] }
            },
            { id: "p3", name: "Alan", color: "#d22a1e", selection: CARET }
        ]);
        expect(plugin.setRemoteCursors).toHaveBeenCalledWith([ {
            id: "p2", name: "Grace", color: "#2066df", kind: "text",
            anchor: [ 0, 2 ], head: [ 0, 2 ]
        } ]);

        const stop = adapter.listen(vi.fn());
        expect([ selection, document, viewDocument ]
            .flatMap((target) => [ ...target.listeners.keys() ]))
            .toEqual([ "change:range", "change:data", "change:isFocused" ]);
        stop();
        expect(selection.listeners.size + document.listeners.size + viewDocument.listeners.size)
            .toBe(0);
    });
});
