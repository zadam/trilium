import type { Collaboration, CollabPerson, CollabSelection } from "@triliumnext/commons";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const options = vi.hoisted(() => ({ syncServerHost: "" }));
vi.mock("../react/hooks.jsx", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks.jsx")>()),
    useTriliumOption: () => [ options.syncServerHost, () => {} ]
}));

import type { CursorAdapter, RemoteSelection } from "../../collab/cursor_sync.js";
import Component from "../../components/component.js";
import type FNote from "../../entities/fnote.js";
import { publishRemoteCursor, setCollabPresence } from "../../services/collab_presence.js";
import server from "../../services/server.js";
import ws from "../../services/ws.js";
import { ParentComponent } from "../react/react_utils.js";
import { useCollabCursors } from "./collaboration.js";

const COLLAB = { collabId: "c1", noteId: "n1" } as Collaboration;
const CARET: CollabSelection = { kind: "text", anchor: [ 0, 1 ], head: [ 0, 1 ] };

function person(id: string, noteId: string, isHost = false): CollabPerson {
    return { id, name: id, color: "#2066df", isHost, noteId, editing: true };
}

function fakeAdapter() {
    let selection: CollabSelection | null = null;
    const listeners = new Set<() => void>();
    return {
        drawn: [] as RemoteSelection[],
        listeners,
        read: () => selection,
        draw(selections: RemoteSelection[]) {
            this.drawn = selections;
        },
        listen(listener: () => void) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        move(next: CollabSelection) {
            selection = next;
            for (const listener of listeners) listener();
        }
    } satisfies CursorAdapter & Record<string, unknown>;
}

function Harness({ adapter }: { adapter: CursorAdapter }) {
    useCollabCursors({ noteId: "n1" } as FNote, adapter);
    return null;
}

const container = document.createElement("div");

function mount(adapter: CursorAdapter) {
    act(() => render(
        <ParentComponent.Provider value={new Component()}>
            <Harness adapter={adapter} />
        </ParentComponent.Provider>,
        container));
}

async function settle(ms = 0) {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
    });
}

afterEach(() => {
    act(() => render(null, container));
    act(() => setCollabPresence("c1", { guests: 0, people: [] }));
    options.syncServerHost = "";
    vi.restoreAllMocks();
});

describe("useCollabCursors", () => {
    it("asks which collaborations show the note once a guest is on one, then shares the carets",
        async () => {
            const get = vi.spyOn(server, "get").mockImplementation(async (url: string) =>
                (url === "collaborations?inScopeOf=n1" ? [ COLLAB ] : []));
            const send = vi.spyOn(ws, "sendOutgoing").mockReturnValue(true);
            const adapter = fakeAdapter();
            mount(adapter);
            await settle();
            expect(get).not.toHaveBeenCalled();

            act(() => setCollabPresence("c1", {
                guests: 1, people: [ person("host", "n1", true), person("p-grace", "n1") ]
            }));
            await settle();
            expect(get).toHaveBeenCalledWith("collaborations?inScopeOf=n1");

            adapter.move(CARET);
            await settle(150);
            expect(send.mock.calls).toEqual([
                [ { type: "collab-cursor", noteId: "n1", selection: CARET } ]
            ]);

            act(() => publishRemoteCursor({
                type: "collab-remote-cursor", collabId: "c1", noteId: "n1",
                person: { id: "p-grace", name: "Grace", color: "#2066df" }, selection: CARET
            }));
            expect(adapter.drawn.map((entry) => entry.name)).toEqual([ "Grace" ]);

            act(() => render(null, container));
            expect(adapter.drawn).toEqual([]);
            expect(adapter.listeners.size).toBe(0);
        });

    it("shares nothing while a sync server serves the collaborations", async () => {
        options.syncServerHost = "https://sync.example";
        vi.spyOn(server, "get").mockResolvedValue([ COLLAB ]);
        act(() => setCollabPresence("c1", { guests: 1, people: [ person("p-grace", "n1") ] }));
        const adapter = fakeAdapter();
        mount(adapter);
        await settle();

        expect(adapter.listeners.size).toBe(0);
    });
});
