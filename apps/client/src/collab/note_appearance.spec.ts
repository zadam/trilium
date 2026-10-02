import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/i18n.js", () => ({ t: (key: string) => key }));

import { setupNoteAppearance } from "./note_appearance.js";

describe("setupNoteAppearance", () => {
    const registry = { sources: [ { prefix: "bx", name: "Boxicons", icon: "bx bx-package", icons: [
        { id: "bx bx-star", terms: [ "star" ] }, { id: "bx bx-home", terms: [ "home" ] }
    ] } ] };
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
        ({ ok: true, json: async () => registry }));
    let events: EventTarget;
    let refreshes: number;

    beforeEach(() => {
        fetchMock.mockClear();
        vi.stubGlobal("fetch", fetchMock);
        events = new EventTarget();
        refreshes = 0;
        events.addEventListener("collab-refresh", () => refreshes++);
        document.body.innerHTML = `
            <button type="button" class="collab-note-icon bx bx-note" data-note-id="n1"></button>
            <nav id="menu"><ul><li>
                <a href="./n1" data-note-id="n1" data-color="#ff8800"
                    data-icon-class="bx bx-star"><span>One</span></a>
            </li></ul></nav>`;
        setupNoteAppearance({
            noteId: "n1",
            strings: { change_color: "Color", change_icon: "Icon", clear_color: "No color" },
            events
        }, "token");
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        document.querySelector(".collab-context-menu")?.remove();
    });

    function rightClick() {
        const row = document.querySelector("a[data-note-id]");
        row?.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true, cancelable: true, clientX: 40, clientY: 50
        }));
        return document.querySelector<HTMLElement>(".collab-context-menu");
    }

    it("opens on a row with the two entries and closes on Escape", () => {
        const menu = rightClick();
        expect(menu).not.toBeNull();
        const items = [ ...document.querySelectorAll(".collab-context-item") ];
        expect(items.map((item) => item.textContent))
            .toEqual([ "Color", "Icon" ]);

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(document.querySelector(".collab-context-menu")).toBeNull();
    });

    it("turns into the color picker, whose clear cell writes no color", async () => {
        const menu = rightClick();
        menu?.querySelector<HTMLButtonElement>(".collab-context-item")?.click();
        expect(menu?.querySelector(".color-picker")).not.toBeNull();

        const clear = menu?.querySelector<HTMLElement>(".color-cell-reset");
        expect(clear).not.toBeNull();
        // The page's own wording reaches the picker.
        expect(menu?.innerHTML).toContain("No color");
        clear?.click();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(fetchMock).toHaveBeenCalledWith("api/notes/n1/appearance", expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ color: null }),
            headers: expect.objectContaining({ "x-csrf-token": "token" })
        }));
    });

    it("asks the page to refresh after a change instead of reloading it", async () => {
        const menu = rightClick();
        menu?.querySelector<HTMLButtonElement>(".collab-context-item")?.click();
        menu?.querySelector<HTMLElement>(".color-cell-reset")?.click();
        await vi.waitFor(() => expect(refreshes).toBe(1));
        expect(document.querySelector(".collab-context-menu")).toBeNull();
    });

    it("opens the icon chooser from the title's icon, and a second press closes it", async () => {
        const icon = document.querySelector<HTMLButtonElement>("button.collab-note-icon");
        icon?.click();
        await vi.waitFor(() =>
            expect(document.querySelectorAll(".collab-icon-choice")).toHaveLength(2));
        expect(document.querySelector(".collab-context-menu")?.getAttribute("role")).toBe("dialog");

        const search = document.querySelector<HTMLInputElement>(".collab-icon-search");
        if (!search) throw new Error("No search box.");
        search.value = "hom";
        search.dispatchEvent(new Event("input"));
        const choices = [ ...document.querySelectorAll<HTMLButtonElement>(".collab-icon-choice") ];
        expect(choices.map((choice) => choice.title)).toEqual([ "home" ]);

        choices[0].click();
        await vi.waitFor(() => expect(refreshes).toBe(1));
        const [ url, init ] = fetchMock.mock.calls.at(-1) ?? [];
        expect(url).toBe("api/notes/n1/appearance");
        expect(init?.body).toBe(JSON.stringify({ iconClass: "bx bx-home" }));

        icon?.click();
        expect(document.querySelector(".collab-context-menu")).not.toBeNull();
        icon?.click();
        expect(document.querySelector(".collab-context-menu")).toBeNull();
    });

    it("stays open while the browser's color chooser is, applying each pick live", async () => {
        // Opening the chooser dispatches nothing more in a browser, which refuses a click on an
        // element that is already being clicked; happy-dom would recurse instead.
        vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
        // The row's color is no preset, so the custom cell holds it and re-applies it when pressed.
        const menu = rightClick();
        menu?.querySelector<HTMLButtonElement>(".collab-context-item")?.click();
        const custom = menu?.querySelector<HTMLElement>(".custom-color-cell");
        expect(custom).not.toBeNull();
        await vi.waitFor(() =>
            expect(custom?.classList.contains("custom-color-cell-empty")).toBe(false));
        custom?.click();
        await vi.waitFor(() => expect(refreshes).toBe(1));
        expect(document.querySelector(".collab-context-menu")).not.toBeNull();

        const input = menu?.querySelector<HTMLInputElement>("input[type=color]");
        if (!input) throw new Error("No color input.");
        input.value = "#123456";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        await vi.waitFor(() => expect(refreshes).toBe(2));
        const [ url, init ] = fetchMock.mock.calls.at(-1) ?? [];
        expect(url).toBe("api/notes/n1/appearance");
        expect(init?.body).toBe(JSON.stringify({ color: "#123456" }));
        expect(document.querySelector(".collab-context-menu")).not.toBeNull();

        // A swatch closes it, as a pick from the app's menu does.
        menu?.querySelector<HTMLElement>(".color-cell-reset")?.click();
        expect(document.querySelector(".collab-context-menu")).toBeNull();
        const sentBodies = () => fetchMock.mock.calls.map(([ , sent ]) => sent?.body);
        await vi.waitFor(() => expect(sentBodies()).toEqual([
            JSON.stringify({ color: "#ff8800" }),
            JSON.stringify({ color: "#123456" }),
            JSON.stringify({ color: null })
        ]));
    });

    it("opens the pickers the note options menu asks for, for the shown note", async () => {
        events.dispatchEvent(new CustomEvent("collab-change-icon", { detail: { x: 10, y: 10 } }));
        await vi.waitFor(() =>
            expect(document.querySelectorAll(".collab-icon-choice")).toHaveLength(2));

        events.dispatchEvent(new CustomEvent("collab-change-color", { detail: { x: 10, y: 10 } }));
        // One panel at a time: the color picker replaced the chooser.
        expect(document.querySelectorAll(".collab-context-menu")).toHaveLength(1);
        const reset = document.querySelector<HTMLElement>(".color-picker .color-cell-reset");
        expect(reset).not.toBeNull();
        reset?.click();
        await vi.waitFor(() => expect(refreshes).toBe(1));
        const [ url, init ] = fetchMock.mock.calls.at(-1) ?? [];
        expect(url).toBe("api/notes/n1/appearance");
        expect(init?.body).toBe(JSON.stringify({ color: null }));
    });
});
