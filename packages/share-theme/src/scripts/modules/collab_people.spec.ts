// @vitest-environment happy-dom
import type { CollabPerson } from "@triliumnext/commons/src/lib/collab.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    ensureJoined, type PeopleBootstrap, setLocalColor, setupPeople, withLocalColors
} from "./collab_people.js";

const STRINGS = {
    people: "People here", you: "(you)", host_tag: "Host", rename_self: "Change your name",
    your_name: "Your name", editing_now: "Editing", change_own_color: "Change your color",
    change_person_color: "Change this person's color on your page", default_color: "Default",
    color_blue: "Blue", color_red: "Red", color_green: "Green", color_purple: "Purple",
    color_orange: "Orange", color_teal: "Teal", color_magenta: "Magenta", color_olive: "Olive"
};

function person(id: string, fields: Partial<CollabPerson> = {}): CollabPerson {
    return {
        id, name: id, color: "#2066df", isHost: false, noteId: null, editing: false, ...fields
    };
}

function bootstrap(fields: Partial<PeopleBootstrap> = {}): PeopleBootstrap {
    return {
        collabId: "c1", noteId: "n1", title: "One", includeSubtree: true, csrfToken: "token",
        selfId: "me", strings: STRINGS, ...fields
    };
}

function start(target = bootstrap()) {
    document.body.innerHTML = `<div id="left-pane"><nav id="menu">
        <a data-note-id="n1"><span>One</span></a><a data-note-id="n2"><span>Two</span></a>
    </nav></div>
    <div class="collab-title-row"><h1 id="title">One</h1>
        <button type="button" class="collab-note-options"></button></div>`;
    const events = new EventTarget();
    setupPeople(target, events);
    // As the socket hands presence on, with this browser's colors.
    const present = (people: CollabPerson[]) => events.dispatchEvent(new CustomEvent(
        "collab-presence",
        { detail: withLocalColors("c1", { type: "collab-presence", people }) }));
    const open = () => document.querySelector<HTMLButtonElement>(".collab-people-toggle")?.click();
    return { events, present, open };
}

function toggle() {
    return document.querySelector<HTMLButtonElement>(".collab-people-toggle");
}

function rows() {
    return [ ...document.querySelectorAll<HTMLElement>(".collab-person") ];
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("setupPeople", () => {
    it("lists who is here in a dropdown by the note options, with their notes and edits", () => {
        const { present, events, open } = start();
        expect(toggle()?.hidden).toBe(true);
        expect(toggle()?.nextElementSibling?.classList.contains("collab-note-options")).toBe(true);

        present([
            person("host", { name: "Ada", isHost: true, noteId: "n2", editing: true }),
            person("me", { name: "<b>Grace</b>", noteId: "n1", color: "#127d3e", editing: true }),
            person("p3", { name: "alan", noteId: "elsewhere" })
        ]);

        expect(toggle()?.hidden).toBe(false);
        expect(toggle()?.textContent).toBe("3");
        expect(document.querySelector(".collab-people")).toBeNull();
        open();
        const panel = document.querySelector<HTMLElement>("body > .collab-people");
        expect(toggle()?.getAttribute("aria-expanded")).toBe("true");
        expect(panel?.querySelector(".collab-people-count")?.textContent).toBe("3");
        expect(rows().map((row) => row.querySelector(".collab-person-text")?.textContent))
            .toEqual([ "AdaHostTwo", "<b>Grace</b>(you)One", "alan" ]);
        // A name is text, however it looks.
        expect(document.querySelector("b")).toBeNull();
        expect(rows().map((row) => row.querySelector(".collab-person-initial")?.textContent))
            .toEqual([ "A", "<", "A" ]);
        expect(rows()[1].style.getPropertyValue("--collab-color")).toBe("#127d3e");
        expect(rows().map((row) => !!row.querySelector(".collab-person-editing")))
            .toEqual([ true, true, false ]);
        expect(rows().map((row) => !!row.querySelector(".collab-person-rename")))
            .toEqual([ false, true, false ]);
        // On the page's own row, the rename button comes before the pencil.
        expect([ ...rows()[1].children ].map((child) => child.classList[0])).toEqual([
            "collab-person-initial", "collab-person-text", "collab-person-color",
            "collab-person-rename", "collab-person-editing"
        ]);
        // Every row offers a color, the guest's own for everyone and the others' for this page.
        const colorTitles = rows().map((row) =>
            row.querySelector(".collab-person-color")?.getAttribute("title"));
        expect(colorTitles).toEqual([
            "Change this person's color on your page", "Change your color",
            "Change this person's color on your page"
        ]);

        // A note renamed meanwhile shows its new title.
        events.dispatchEvent(new CustomEvent("collab-update", {
            detail: { notes: [ { noteId: "n2", title: "Two renamed" } ] }
        }));
        expect(rows()[0].querySelector(".collab-person-note")?.textContent).toBe("Two renamed");

        // With nobody left, the dropdown goes away.
        present([]);
        expect(toggle()?.hidden).toBe(true);
        expect(document.querySelector(".collab-people")).toBeNull();

        present([ person("p2") ]);
        open();
        events.dispatchEvent(new CustomEvent("collab-removed"));
        expect(document.querySelector(".collab-people")).toBeNull();
        expect(toggle()).toBeNull();
    });

    it("closes on a press outside it or on Escape, but not on one in its color menu", () => {
        const { present, open } = start();
        present([ person("me"), person("p2") ]);
        const press = (target: Element | null | undefined) =>
            target?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

        open();
        document.querySelector<HTMLButtonElement>(".collab-person-color")?.click();
        press(document.querySelector(".collab-menu:not(.collab-people) .collab-menu-item"));
        expect(document.querySelector(".collab-people")).not.toBeNull();
        press(document.getElementById("title"));
        expect(document.querySelector(".collab-people")).toBeNull();
        expect(toggle()?.getAttribute("aria-expanded")).toBe("false");

        open();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(document.querySelector(".collab-people")).toBeNull();
    });

    it("names no note when the collaboration has only the one", () => {
        const { present, open } = start(bootstrap({ includeSubtree: false }));
        present([ person("p2", { noteId: "n1" }) ]);
        open();
        expect(document.querySelector(".collab-person-note")).toBeNull();
    });

    it("renames the page's own person in place, and leaves the name on Escape", async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }));
        vi.stubGlobal("fetch", fetchMock);
        const { present, open } = start();
        present([ person("me", { name: "Grace" }) ]);
        open();

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

describe("person colors", () => {
    const RED = "#d22a1e";
    const GREEN = "#127d3e";

    afterEach(() => {
        setLocalColor("c1", "p2", null);
        document.querySelector(".collab-menu:not(.collab-people)")?.remove();
    });

    function pick(personId: string, label: string) {
        document.querySelector<HTMLButtonElement>(
            `.collab-person[data-person-id="${personId}"] .collab-person-color`)?.click();
        const item = [ ...document.querySelectorAll<HTMLButtonElement>(".collab-menu-item") ]
            .find((row) => row.textContent === label);
        if (!item) throw new Error(`no ${label} in the menu`);
        item.click();
    }

    function colorOf(personId: string) {
        return document.querySelector<HTMLElement>(`.collab-person[data-person-id="${personId}"]`)
            ?.style.getPropertyValue("--collab-color");
    }

    it("lets a guest recolor themselves for everyone, and others for their own page", async () => {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }));
        vi.stubGlobal("fetch", fetchMock);
        const { present, open } = start();
        present([ person("me"), person("p2") ]);
        open();

        // The menu marks the color the person has now, in the colors themselves.
        document.querySelector<HTMLButtonElement>(".collab-person-self .collab-person-color")
            ?.click();
        const chosen = document.querySelector<HTMLElement>(".collab-menu [aria-checked=true]");
        expect(chosen?.textContent).toBe("Blue");
        expect(chosen?.querySelector<HTMLElement>(".collab-menu-icon")?.style.color)
            .not.toBe("");
        document.querySelector(".collab-menu:not(.collab-people)")?.remove();

        pick("me", "Green");
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(fetchMock.mock.calls[0][0]).toBe("api/me");
        expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ color: GREEN }));
        expect(colorOf("me")).toBe("#2066df");

        pick("p2", "Red");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(colorOf("p2")).toBe(RED);
        expect(JSON.parse(localStorage.getItem("collab-colors:c1") ?? "{}")).toEqual({ p2: RED });

        // The color holds through the next presence, and reaches the person's cursor.
        present([ person("me", { color: GREEN }), person("p2") ]);
        expect([ colorOf("me"), colorOf("p2") ]).toEqual([ GREEN, RED ]);
        const cursor = { type: "collab-remote-cursor", person: { id: "p2", color: "#2066df" } };
        expect(withLocalColors("c1", cursor).person.color).toBe(RED);
        expect(cursor.person.color).toBe("#2066df");

        pick("p2", "Default");
        expect(colorOf("p2")).toBe("#2066df");
        expect(JSON.parse(localStorage.getItem("collab-colors:c1") ?? "{}")).toEqual({});
    });
});
