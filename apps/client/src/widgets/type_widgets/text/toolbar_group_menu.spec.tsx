import type { ToolbarGroupMenuItem, ToolbarGroupMenuRequest } from "@triliumnext/ckeditor5";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createToolbarGroupMenuHost } from "./toolbar_group_menu";

const ICON = `<svg viewBox="0 0 20 20"><path d="M0 0h20v20H0z"/></svg>`;

describe("createToolbarGroupMenuHost", () => {
    const anchor = document.createElement("button");
    anchor.setAttribute("aria-labelledby", "insert-label");
    document.body.append(anchor);
    let host = createToolbarGroupMenuHost();
    afterEach(() => {
        host.destroy();
        host = createToolbarGroupMenuHost();
    });

    function show() {
        const runs: string[] = [];
        // The plugin hides the menu before it runs an entry.
        const run = (name: string) => () => {
            host.hide();
            runs.push(name);
        };
        const items: ToolbarGroupMenuItem[] = [
            { kind: "entry", label: "Link", icon: ICON, isEnabled: true, run: run("link") },
            { kind: "separator" },
            { kind: "entry", label: "Math", isEnabled: false, run: run("math") },
            {
                kind: "entry", label: "Date/time", icon: ICON, isEnabled: true, run: run("date"),
                children: [ { kind: "entry", label: "2026-10-05", isEnabled: true, run: run("iso") } ]
            }
        ];
        const setElement = vi.fn<ToolbarGroupMenuRequest["setElement"]>();
        const onClose = vi.fn<ToolbarGroupMenuRequest["onClose"]>();
        host.show({ anchor, items, setElement, onClose });

        const menu = document.querySelector<HTMLElement>(".tn-popup.tn-menu");
        if (!menu) throw new Error("expected the menu to render");
        return { menu, runs, setElement, onClose };
    }

    function rowTitled(title: string) {
        const found = [ ...document.querySelectorAll<HTMLElement>("li.dropdown-item") ]
            .find((item) => item.textContent === title);
        if (!found) throw new Error(`expected a row titled ${title}`);
        return found;
    }

    const press = (element: HTMLElement) => {
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    };

    it("draws the entries as the app's menu, with their SVG icons, and hands the editor its element", () => {
        const { menu, setElement } = show();

        expect(setElement).toHaveBeenCalledWith(menu);
        expect(menu.classList).toContain("tn-dropdown-menu");
        expect(menu.getAttribute("aria-labelledby")).toBe("insert-label");
        const rows = [ ...menu.querySelectorAll(":scope > .tn-menu-scroll > li") ]
            .map((item) => `${item.className} ${item.textContent}`);
        expect(rows).toEqual([
            "dropdown-item Link",
            "dropdown-divider ",
            "dropdown-item disabled Math",
            "dropdown-item dropdown-submenu tn-menu-split Date/time"
        ]);
        expect(rowTitled("Link").querySelector(".tn-svg-icon > svg")).not.toBeNull();
        expect(rowTitled("Date/time").querySelector(".tn-svg-icon > svg")).not.toBeNull();
    });

    it("checks the entry that is on, and marks only those that can be on as checkable", () => {
        const items: ToolbarGroupMenuItem[] = [
            { kind: "entry", label: "Paragraph", icon: ICON, isEnabled: true, isOn: false },
            { kind: "entry", label: "Heading 2", icon: ICON, isEnabled: true, isOn: true, className: "ck-heading_heading2" },
            { kind: "entry", label: "Link", icon: ICON, isEnabled: true }
        ];
        host.show({ anchor, items, setElement: vi.fn(), onClose: vi.fn() });

        const paragraph = rowTitled("Paragraph");
        const heading = rowTitled("Heading 2");
        const link = rowTitled("Link");
        expect([ paragraph, heading, link ].map((row) => [ row.role, row.getAttribute("aria-checked") ])).toEqual([
            [ "menuitemcheckbox", "false" ],
            [ "menuitemcheckbox", "true" ],
            [ "menuitem", null ]
        ]);
        expect(heading.querySelector(".bx-check")).not.toBeNull();
        expect(heading.classList).toContain("ck-heading_heading2");
        // A class sizing the label, as the font size rows do, leaves the check and the gap as they are.
        expect(heading.querySelector(".toolbar-group-menu-label")?.textContent).toBe("Heading 2");
        expect(paragraph.querySelector(".bx-check")).toBeNull();
    });

    it("draws the tiles layout as a grid of tiles per group, the one on checked", () => {
        const runs: string[] = [];
        const run = (name: string) => () => {
            host.hide();
            runs.push(name);
        };
        const items: ToolbarGroupMenuItem[] = [
            { kind: "entry", label: "Paragraph", icon: ICON, isEnabled: true, isOn: false, run: run("paragraph") },
            { kind: "entry", label: "Heading 2", icon: ICON, isEnabled: true, isOn: true, run: run("heading") },
            { kind: "separator" },
            { kind: "entry", label: "Bulleted List", icon: ICON, isEnabled: false, isOn: false, run: run("list") }
        ];
        host.show({ anchor, items, layout: "tiles", setElement: vi.fn(), onClose: vi.fn() });

        const menu = document.querySelector<HTMLElement>(".tn-popup.tn-menu");
        const groups = [ ...menu?.querySelectorAll(".toolbar-group-menu-tiles") ?? [] ];
        expect(groups.map((group) => [ ...group.querySelectorAll(".tn-menu-action") ].map((tile) => tile.textContent)))
            .toEqual([ [ "Paragraph", "Heading 2" ], [ "Bulleted List" ] ]);

        const tiles = [ ...menu?.querySelectorAll<HTMLButtonElement>(".tn-menu-action") ?? [] ];
        expect(tiles.map((tile) => [ tile.role, tile.getAttribute("aria-checked"), tile.disabled ])).toEqual([
            [ "menuitemcheckbox", "false", false ],
            [ "menuitemcheckbox", "true", false ],
            [ "menuitemcheckbox", "false", true ]
        ]);
        expect(tiles[0]?.querySelector(".tn-svg-icon > svg")).not.toBeNull();

        tiles[0]?.click();
        expect(runs).toEqual([ "paragraph" ]);
        expect(menu?.isConnected).toBe(false);
    });

    it("runs an entry without closing a second time, and leaves a disabled one alone", () => {
        const { menu, runs, setElement, onClose } = show();

        press(rowTitled("Math"));
        expect(runs).toEqual([]);

        press(rowTitled("Link"));
        expect(runs).toEqual([ "link" ]);
        expect(onClose).not.toHaveBeenCalled();
        expect(setElement).toHaveBeenLastCalledWith(null);
        expect(menu.isConnected).toBe(false);
    });

    it("runs a submenu's opener and its rows", async () => {
        const opened = show();
        press(rowTitled("Date/time"));
        expect(opened.runs).toEqual([ "date" ]);

        const { menu, runs } = show();
        rowTitled("Date/time").dispatchEvent(new PointerEvent("pointerenter"));
        await vi.waitFor(() => expect(menu.querySelector(".dropdown-submenu > .dropdown-menu")).not.toBeNull());
        press(rowTitled("2026-10-05"));
        expect(runs).toEqual([ "iso" ]);
    });

    it("returns focus to the group's button on Escape, and not on a press elsewhere", () => {
        const escaped = show();
        escaped.menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        expect(escaped.onClose).toHaveBeenCalledExactlyOnceWith(true);
        expect(escaped.menu.isConnected).toBe(false);

        const dismissed = show();
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        expect(dismissed.onClose).toHaveBeenCalledExactlyOnceWith(false);
        expect(dismissed.setElement).toHaveBeenLastCalledWith(null);
    });
});
