// @vitest-environment happy-dom
import type { CollabPerson } from "@triliumnext/commons/src/lib/collab.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureJoined, type PeopleBootstrap, setupPeople } from "./collab_people.js";

const STRINGS = {
    people: "People here", you: "(you)", host_tag: "Host", rename_self: "Change your name",
    your_name: "Your name", editing_now: "Editing"
};

function person(id: string, fields: Partial<CollabPerson> = {}): CollabPerson {
    return {
        id, name: id, color: "#2066df", isHost: false, noteId: null, editing: false, ...fields
    };
}

function bootstrap(fields: Partial<PeopleBootstrap> = {}): PeopleBootstrap {
    return {
        noteId: "n1", title: "One", includeSubtree: true, csrfToken: "token", selfId: "me",
        strings: STRINGS, ...fields
    };
}

function start(target = bootstrap()) {
    document.body.innerHTML = `<div id="left-pane"><nav id="menu">
        <a data-note-id="n1"><span>One</span></a><a data-note-id="n2"><span>Two</span></a>
    </nav></div>`;
    const events = new EventTarget();
    setupPeople(target, events);
    const present = (people: CollabPerson[]) => events.dispatchEvent(
        new CustomEvent("collab-presence", { detail: { people } }));
    return { events, present };
}

function rows() {
    return [ ...document.querySelectorAll<HTMLElement>(".collab-person") ];
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("setupPeople", () => {
    it("lists who is here at the foot of the sidebar, with where they are and what they do", () => {
        const { present, events } = start();
        const panel = document.querySelector<HTMLElement>("#left-pane > .collab-people");
        expect(panel?.hidden).toBe(true);

        present([
            person("host", { name: "Ada", isHost: true, noteId: "n2", editing: true }),
            person("me", { name: "<b>Grace</b>", noteId: "n1", color: "#127d3e" }),
            person("p3", { name: "alan", noteId: "elsewhere" })
        ]);

        expect(panel?.hidden).toBe(false);
        expect(panel?.querySelector(".collab-people-count")?.textContent).toBe("3");
        expect(rows().map((row) => row.querySelector(".collab-person-text")?.textContent))
            .toEqual([ "AdaHostTwo", "<b>Grace</b>(you)One", "alan" ]);
        // A name is text, however it looks.
        expect(document.querySelector("b")).toBeNull();
        expect(rows().map((row) => row.querySelector(".collab-person-initial")?.textContent))
            .toEqual([ "A", "<", "A" ]);
        expect(rows()[1].style.getPropertyValue("--collab-color")).toBe("#127d3e");
        expect(rows().map((row) => !!row.querySelector(".collab-person-editing")))
            .toEqual([ true, false, false ]);
        expect(rows().map((row) => !!row.querySelector(".collab-person-rename")))
            .toEqual([ false, true, false ]);

        // A note renamed meanwhile shows its new title.
        events.dispatchEvent(new CustomEvent("collab-update", {
            detail: { notes: [ { noteId: "n2", title: "Two renamed" } ] }
        }));
        expect(rows()[0].querySelector(".collab-person-note")?.textContent).toBe("Two renamed");

        present([]);
        expect(panel?.hidden).toBe(true);

        present([ person("p2") ]);
        events.dispatchEvent(new CustomEvent("collab-removed"));
        expect(document.querySelector(".collab-people")).toBeNull();
    });

    it("names no note when the collaboration has only the one", () => {
        const { present } = start(bootstrap({ includeSubtree: false }));
        present([ person("p2", { noteId: "n1" }) ]);
        expect(document.querySelector(".collab-person-note")).toBeNull();
    });

    it("renames the page's own person in place, and leaves the name on Escape", async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }));
        vi.stubGlobal("fetch", fetchMock);
        const { present } = start();
        present([ person("me", { name: "Grace" }) ]);

        const rename = () => {
            document.querySelector<HTMLButtonElement>(".collab-person-rename")?.click();
            const input = document.querySelector<HTMLInputElement>(".collab-person-rename-input");
            if (!input) throw new Error("no rename field");
            return input;
        };

        let input = rename();
        expect(input.value).toBe("Grace");
        expect(input.maxLength).toBe(40);
        // Presence arriving mid-rename leaves the field alone.
        present([ person("me", { name: "Grace" }), person("p2") ]);
        expect(document.querySelector(".collab-person-rename-input")).toBe(input);

        input.value = "Grace Hopper";
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        const [ url, init ] = fetchMock.mock.calls[0];
        expect(url).toBe("api/me");
        expect(init).toMatchObject({
            method: "PUT", body: JSON.stringify({ name: "Grace Hopper" })
        });
        expect(new Headers(init?.headers).get("x-csrf-token")).toBe("token");
        await vi.waitFor(() =>
            expect(document.querySelector(".collab-person-rename-input")).toBeNull());
        expect(rows()).toHaveLength(2);

        input = rename();
        input.value = "Someone else";
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        input.dispatchEvent(new FocusEvent("blur"));
        await vi.waitFor(() =>
            expect(document.querySelector(".collab-person-rename-input")).toBeNull());
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe("ensureJoined", () => {
    it("joins once, for a page without a guest of its own", async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
            ok: true, json: async () => ({ selfId: "p-new", csrfToken: "fresh" })
        }));
        vi.stubGlobal("fetch", fetchMock);

        const joined = bootstrap();
        await ensureJoined(joined);
        expect(fetchMock).not.toHaveBeenCalled();

        const viewer = bootstrap({ selfId: null, csrfToken: null });
        await ensureJoined(viewer);
        expect(fetchMock).toHaveBeenCalledWith("api/join", expect.objectContaining({
            method: "POST", body: "{}"
        }));
        expect(viewer).toMatchObject({ selfId: "p-new", csrfToken: "fresh" });

        // A page whose join fails still reads; it just has no place in the list.
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        const offline = bootstrap({ selfId: null });
        vi.spyOn(console, "error").mockImplementation(() => {});
        await ensureJoined(offline);
        expect(offline.selfId).toBeNull();
    });
});
