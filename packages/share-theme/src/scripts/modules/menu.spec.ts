// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildMenu, type MenuRow, placeMenu } from "./menu.js";

function rowsOf(element: Element | null | undefined) {
    return [ ...element?.querySelectorAll<HTMLElement>(".collab-menu-item") ?? [] ]
        .filter((row) => row.closest(".collab-menu") === element);
}

function labels(element: Element | null | undefined) {
    return rowsOf(element).filter((row) => !row.hidden).map((row) => row.textContent);
}

function rowLabelled(element: Element | null | undefined, label: string) {
    return rowsOf(element).find((row) => row.textContent === label);
}

function submenuOf(menu: HTMLElement) {
    return menu.querySelector<HTMLElement>(".collab-submenu");
}

function key(target: Element | null | undefined, name: string) {
    target?.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
}

describe("buildMenu", () => {
    const picked: string[] = [];
    const close = vi.fn();
    let menu: HTMLElement;

    beforeEach(() => {
        picked.length = 0;
        close.mockClear();
        const titles = [ "Plain text", "JSX", "Python", "Rust", "Ruby" ];
        const languages: MenuRow[] = titles.map((label) => ({
            kind: "item",
            label,
            checked: label === "Rust",
            disabled: label === "JSX",
            title: label === "JSX" ? "Only the host" : undefined,
            run: () => picked.push(label)
        }));
        menu = buildMenu([
            { kind: "submenu", icon: "bx bx-file", label: "Note type", rows: () => [
                { kind: "item", label: "Text", checked: false, run: () => picked.push("Text") },
                { kind: "item", label: "Code", checked: true, run: () => picked.push("Code") }
            ] },
            { kind: "submenu", icon: "bx bx-code-curly", label: "Language",
                search: "Search",
                rows: () => languages },
            { kind: "divider" },
            {
                kind: "item", icon: "bx bx-link", label: "Copy link", run: () => picked.push("Copy")
            },
            { kind: "item", label: "Print", run: () => picked.push("Print") }
        ], close, "Note options");
        document.body.replaceChildren(menu);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("draws an icon column, a check for the chosen row and a chevron on submenu rows", () => {
        expect(menu.getAttribute("role")).toBe("menu");
        expect(labels(menu)).toEqual([ "Note type", "Language", "Copy link", "Print" ]);
        expect(menu.querySelector("[role=separator]")).not.toBeNull();

        const noteType = rowLabelled(menu, "Note type");
        expect(noteType?.getAttribute("aria-haspopup")).toBe("menu");
        expect(noteType?.querySelector(".collab-menu-arrow")).not.toBeNull();
        expect(rowLabelled(menu, "Copy link")?.querySelector(".collab-menu-icon")?.className)
            .toContain("bx-link");
        // A row without an icon keeps its column, so the labels line up.
        expect(rowLabelled(menu, "Print")?.querySelector(".collab-menu-icon")).not.toBeNull();

        noteType?.click();
        const code = rowLabelled(submenuOf(menu), "Code");
        expect(code?.getAttribute("aria-checked")).toBe("true");
        expect(code?.querySelector(".collab-menu-icon")?.className).toContain("bx-check");
        expect(rowLabelled(submenuOf(menu), "Text")?.getAttribute("aria-checked")).toBe("false");
    });

    it("opens a submenu once the pointer rests on its row, and closes it for another row", () => {
        vi.useFakeTimers();
        const rest = (label: string) =>
            rowLabelled(menu, label)?.dispatchEvent(new Event("pointerenter"));

        rest("Note type");
        expect(submenuOf(menu)).toBeNull();
        vi.advanceTimersByTime(150);
        expect(labels(submenuOf(menu))).toEqual([ "Text", "Code" ]);
        expect(rowLabelled(menu, "Note type")?.getAttribute("aria-expanded")).toBe("true");

        // One submenu replaces another at once.
        rest("Language");
        expect(submenuOf(menu)?.querySelector(".collab-menu-search")).not.toBeNull();

        // Crossing a plain row on the way into the submenu keeps it open.
        rest("Copy link");
        submenuOf(menu)?.dispatchEvent(new Event("pointerenter"));
        vi.advanceTimersByTime(150);
        expect(submenuOf(menu)).not.toBeNull();

        rest("Print");
        vi.advanceTimersByTime(150);
        expect(submenuOf(menu)).toBeNull();
    });

    it("runs a row picked in a submenu after closing the menu", () => {
        rowLabelled(menu, "Note type")?.click();
        rowLabelled(submenuOf(menu), "Text")?.click();

        expect(close).toHaveBeenCalledTimes(1);
        expect(picked).toEqual([ "Text" ]);
    });

    it("moves with the arrow keys, into a submenu with the right arrow and out with Escape", () => {
        const reached: string[] = [];
        const listen = (event: KeyboardEvent) => reached.push(event.key);
        document.addEventListener("keydown", listen);
        const noteType = rowLabelled(menu, "Note type");
        noteType?.focus();

        key(noteType, "ArrowUp");
        expect(document.activeElement?.textContent).toBe("Print");
        key(document.activeElement, "ArrowDown");
        expect(document.activeElement).toBe(noteType);

        key(noteType, "ArrowRight");
        expect(document.activeElement?.textContent).toBe("Text");
        key(document.activeElement, "ArrowDown");
        expect(document.activeElement?.textContent).toBe("Code");

        // Escape leaves the submenu only; the page's own Escape would close the whole menu.
        key(document.activeElement, "Escape");
        expect(submenuOf(menu)).toBeNull();
        expect(document.activeElement).toBe(noteType);
        expect(reached).not.toContain("Escape");
        document.removeEventListener("keydown", listen);
    });

    it("shows a disabled row with its reason, and lets no click, key or search pick it", () => {
        rowLabelled(menu, "Language")?.click();
        const jsx = rowLabelled(submenuOf(menu), "JSX");
        expect(jsx?.getAttribute("aria-disabled")).toBe("true");
        expect(jsx?.title).toBe("Only the host");

        jsx?.click();
        expect(picked).toEqual([]);
        expect(close).not.toHaveBeenCalled();

        // The keys pass over it, from the row above to the row below.
        rowLabelled(submenuOf(menu), "Plain text")?.focus();
        key(document.activeElement, "ArrowDown");
        expect(document.activeElement?.textContent).toBe("Python");

        // Enter takes the first row left that can be picked.
        const search = submenuOf(menu)?.querySelector<HTMLInputElement>(".collab-menu-search");
        if (search) {
            search.value = "s";
            search.dispatchEvent(new Event("input"));
        }
        expect(labels(submenuOf(menu))).toEqual([ "JSX", "Rust" ]);
        key(search, "Enter");
        expect(picked).toEqual([ "Rust" ]);
    });

    it("points the submenu arrows to the side the submenus open on, as the app does", () => {
        const arrows = () => rowsOf(menu).map((row) =>
            row.querySelector(".collab-menu-arrow")?.className.match(/bx-chevron-\w+/)?.[0])
            .filter(Boolean);
        const placeAt = (left: number) => {
            menu.getBoundingClientRect = () => new DOMRect(left, 40, 200, 300);
            placeMenu(menu, new DOMRect(left + 160, 0, 40, 32));
        };
        // The test environment lays nothing out, so the window is given a width.
        Object.defineProperty(document.documentElement, "clientWidth", {
            configurable: true, get: () => 1300
        });

        // Under a button at the right edge, only the left has room for a submenu as wide.
        placeAt(1090);
        expect(menu.classList.contains("collab-menu-drop-start")).toBe(true);
        expect(arrows()).toEqual([ "bx-chevron-left", "bx-chevron-left" ]);

        placeAt(100);
        expect(menu.classList.contains("collab-menu-drop-start")).toBe(false);
        expect(arrows()).toEqual([ "bx-chevron-right", "bx-chevron-right" ]);
        Reflect.deleteProperty(document.documentElement, "clientWidth");
    });

    it("narrows a searchable submenu to what is typed, Enter picking the first row left", () => {
        key(rowLabelled(menu, "Language"), "Enter");
        const search = document.activeElement;
        expect(search?.classList.contains("collab-menu-search")).toBe(true);

        if (search instanceof HTMLInputElement) {
            search.value = " RU ";
            search.dispatchEvent(new Event("input"));
        }
        expect(labels(submenuOf(menu))).toEqual([ "Rust", "Ruby" ]);

        key(search, "Enter");
        expect(picked).toEqual([ "Rust" ]);
    });
});
