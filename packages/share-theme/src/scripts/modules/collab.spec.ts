// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

// The editor entry loads through a build-time glob the test runner cannot resolve.
vi.mock("./client_entry.js", () => ({ loadClientEntry: vi.fn() }));

import {
    advanceHistory, collabNoteTarget, connectGuestSocket, followPageChanges, followTreeChanges,
    formatTimes,
    setupAddButtons, setupContentsPanel, setupLogoutConfirmation, setupNavigation, setupNoteOptions,
    setupPasswordReveal, setupSidebarResize, setupTabs
} from "./collab.js";

describe("formatTimes", () => {
    it("writes a date as the app's title does, with the full date and time on hover", () => {
        document.body.innerHTML = `<time datetime="2026-10-01T21:03:17.000Z">2026-10-01</time>`;
        formatTimes(document);
        const time = document.querySelector("time");
        const date = new Date("2026-10-01T21:03:17.000Z");

        expect(time?.textContent).toBe(date.toLocaleDateString(undefined, { dateStyle: "medium" }));
        expect(time?.title)
            .toBe(date.toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" }));
    });
});

describe("setupSidebarResize", () => {
    it("widens the sidebar by its edge or the arrow keys, within bounds, and remembers it", () => {
        localStorage.clear();
        document.body.innerHTML = `<div id="left-pane"></div>
            <div class="collab-left-pane-resizer" tabindex="0"></div>`;
        const pane = document.getElementById("left-pane");
        const handle = document.querySelector<HTMLElement>(".collab-left-pane-resizer");
        if (!pane || !handle) throw new Error("no sidebar");
        pane.getBoundingClientRect = () => ({ left: 52, width: 250 }) as DOMRect;
        handle.setPointerCapture = vi.fn();
        const width = () => document.documentElement.style.getPropertyValue(
            "--collab-left-pane-width");
        setupSidebarResize();

        handle.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 302 }));
        expect(document.documentElement.classList.contains("collab-resizing")).toBe(true);
        handle.dispatchEvent(new PointerEvent("pointermove", { clientX: 352 }));
        expect(width()).toBe("300px");
        // Never narrower than a row of the tree can be read in.
        handle.dispatchEvent(new PointerEvent("pointermove", { clientX: 60 }));
        expect(width()).toBe("160px");
        handle.dispatchEvent(new PointerEvent("pointerup", { clientX: 60 }));
        expect(document.documentElement.classList.contains("collab-resizing")).toBe(false);
        expect(localStorage.getItem("collab-left-pane-width")).toBe("160");

        // A press that does not move, as in a double click, keeps what was remembered.
        handle.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 212 }));
        handle.dispatchEvent(new PointerEvent("pointerup", { clientX: 212 }));
        expect(localStorage.getItem("collab-left-pane-width")).toBe("160");

        handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
        expect(width()).toBe("266px");
        // A double click goes back to the theme's width.
        handle.dispatchEvent(new MouseEvent("dblclick"));
        expect(width()).toBe("");
        expect(localStorage.getItem("collab-left-pane-width")).toBeNull();
    });
});

describe("setupLogoutConfirmation", () => {
    it("logs out only once the guest confirms it", () => {
        document.body.innerHTML = `<form class="collab-logout" data-confirm="Log out?">
            <button type="submit"></button></form>`;
        const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
        vi.stubGlobal("confirm", confirm);
        setupLogoutConfirmation();
        const submit = () => {
            const event = new Event("submit", { cancelable: true });
            document.querySelector("form")?.dispatchEvent(event);
            return event.defaultPrevented;
        };

        expect(submit()).toBe(true);
        expect(confirm).toHaveBeenCalledWith("Log out?");
        expect(submit()).toBe(false);
        vi.unstubAllGlobals();
    });
});

describe("setupPasswordReveal", () => {
    it("shows and hides the password from the eye, keeping the labels in step", () => {
        document.body.innerHTML = `
            <span class="collab-password">
                <input type="password" name="password" value="hunter2">
                <button type="button" aria-pressed="false" aria-label="Show"
                    data-show="Show" data-hide="Hide"></button>
            </span>`;
        const box = document.querySelector(".collab-password");
        const input = document.querySelector("input");
        const toggle = document.querySelector("button");
        if (!box || !input || !toggle) throw new Error("fixture");

        setupPasswordReveal();

        // Pressing the eye must not move the focus out of the box.
        const mousedown = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
        toggle.dispatchEvent(mousedown);
        expect(mousedown.defaultPrevented).toBe(true);

        toggle.click();
        expect(input.type).toBe("text");
        expect(input.value).toBe("hunter2");
        expect(box.classList.contains("revealed")).toBe(true);
        expect(toggle.getAttribute("aria-pressed")).toBe("true");
        expect(toggle.getAttribute("aria-label")).toBe("Hide");

        toggle.click();
        expect(input.type).toBe("password");
        expect(box.classList.contains("revealed")).toBe(false);
        expect(toggle.getAttribute("aria-pressed")).toBe("false");
        expect(toggle.getAttribute("aria-label")).toBe("Show");
    });
});

describe("setupTabs", () => {
    const bootstrap = (noteId: string, title: string) => ({
        collabId: "c1", rootNoteId: "root", noteId, title, includeSubtree: true,
        capabilities: [ "view" ],
        csrfToken: null,
        strings: { tabs: "Open notes", close_tab: "Close", back: "Back", forward: "Forward" }
    });

    it("keeps the opened notes as tabs across page loads and closes one on request", () => {
        sessionStorage.clear();
        document.body.innerHTML = `<div id="right-pane"><div id="main"></div></div>`;
        setupTabs(bootstrap("root", "Root"), new EventTarget());
        expect(tabTitles()).toEqual([ "Root" ]);
        // The tab row sits in the header after back and forward, which have nowhere to go yet.
        // The header runs across the top of the note and its contents panel alike.
        const row = document.querySelector("#right-pane > #collab-header:first-child"
            + " > .collab-tab-row");
        expect([ ...row?.children ?? [] ].map((child) => child.className)).toEqual([
            "collab-history-button bx bx-left-arrow-alt",
            "collab-history-button bx bx-right-arrow-alt",
            "collab-tabs"
        ]);
        expect([ ...row?.querySelectorAll("button") ?? [] ].map((button) => button.disabled))
            .toEqual([ true, true ]);
        expect(row?.querySelector("button")?.getAttribute("aria-label")).toBe("Back");
        // A lone tab has nothing to close.
        expect(document.querySelector(".collab-tab-close")).toBeNull();

        // The next page load, on a child, adds it beside the root and marks it active.
        document.body.innerHTML = `<nav id="collab-launcher">
            <button id="toc-pane-toggle-button" class="header-button"></button></nav>
            <div id="main"></div>`;
        const toc = document.getElementById("toc-pane-toggle-button");
        const events = new EventTarget();
        setupTabs(bootstrap("child", "Child"), events);
        // The button that shows the contents moves to the end of the tab row, as in the app.
        expect(document.querySelector(".collab-tab-row")?.lastElementChild).toBe(toc);
        expect(toc?.classList.contains("collab-history-button")).toBe(true);
        const tabs = [ ...document.querySelectorAll<HTMLAnchorElement>(".collab-tab") ];
        expect(tabTitles()).toEqual([ "Root", "Child" ]);
        expect(tabs[0].getAttribute("href")).toBe("./");
        expect(tabs[1].getAttribute("href")).toBe("./child");
        expect(tabs[1].classList.contains("active")).toBe(true);

        // A rename arriving over the socket renames the tab.
        events.dispatchEvent(new CustomEvent("collab-update", {
            detail: {
                notes: [ { noteId: "root", title: "Renamed" } ],
                treeChanged: false,
                settingsChanged: false
            }
        }));
        expect(document.querySelector(".collab-tab-title")?.textContent).toBe("Renamed");

        // Closing the inactive root tab drops it and keeps the page.
        document.querySelector<HTMLButtonElement>(".collab-tab .collab-tab-close")?.click();
        expect(tabTitles()).toEqual([ "Child" ]);
        expect(JSON.parse(sessionStorage.getItem("collab-tabs:c1") ?? "[]"))
            .toEqual([ { noteId: "child", title: "Child" } ]);
    });

    function tabTitles() {
        return [ ...document.querySelectorAll(".collab-tab-title") ].map((tab) => tab.textContent);
    }

    it("closes the contents panel from its own button and folds its sections", () => {
        document.body.innerHTML = `<button id="toc-pane-toggle-button"></button>
            <div id="toc-pane"><section class="collab-panel-card">
                <div class="collab-panel-card-row">
                    <button class="collab-panel-card-header" aria-expanded="true"></button>
                    <button class="collab-panel-close"></button>
                </div><ul id="toc"></ul></section></div>`;
        const toggle = vi.fn();
        document.getElementById("toc-pane-toggle-button")?.addEventListener("click", toggle);
        const card = document.querySelector(".collab-panel-card");
        const header = document.querySelector<HTMLButtonElement>(".collab-panel-card-header");
        setupContentsPanel();

        document.querySelector<HTMLButtonElement>(".collab-panel-close")?.click();
        expect(toggle).toHaveBeenCalledTimes(1);

        header?.click();
        expect(card?.classList.contains("collapsed")).toBe(true);
        expect(header?.getAttribute("aria-expanded")).toBe("false");
        // A pane swapped in by an in-place navigation answers too.
        document.getElementById("toc-pane")?.replaceWith(
            document.getElementById("toc-pane")?.cloneNode(true) ?? "");
        document.querySelector<HTMLButtonElement>(".collab-panel-card-header")?.click();
        expect(document.querySelector(".collab-panel-card")?.classList.contains("collapsed"))
            .toBe(false);
    });

    it("scrolls the tabs sideways with the wheel and keeps the open one in view", () => {
        sessionStorage.setItem("collab-tabs:c1", JSON.stringify([
            { noteId: "root", title: "Root" }, { noteId: "n1", title: "One" }
        ]));
        const scrolled = vi.spyOn(HTMLElement.prototype, "scrollIntoView")
            .mockImplementation(() => {});
        document.body.innerHTML = `<div id="right-pane"><div id="main"></div></div>`;
        setupTabs(bootstrap("n1", "One"), new EventTarget());
        expect(scrolled.mock.contexts.at(-1)).toBe(document.querySelector(".collab-tab.active"));
        scrolled.mockRestore();

        const bar = document.querySelector<HTMLElement>(".collab-tabs");
        if (!bar) throw new Error("no tab bar");
        Object.defineProperty(bar, "scrollWidth", { value: 900 });
        Object.defineProperty(bar, "clientWidth", { value: 300 });
        const wheel = new WheelEvent("wheel", { deltaY: 120, cancelable: true });
        bar.dispatchEvent(wheel);

        expect(bar.scrollLeft).toBe(120);
        expect(wheel.defaultPrevented).toBe(true);
    });

    it("opens a note from the tree in a tab behind the open one on a modified or middle click",
        () => {
            sessionStorage.clear();
            document.body.innerHTML = `<div id="right-pane"><div id="main"></div></div>
                <nav id="menu"><a href="./n2" data-note-id="n2" data-icon-class="bx bx-file">
                    <span><i></i> Two</span></a>
                <a href="./n3" data-note-id="n3"><span><i></i> Three</span></a></nav>`;
            setupTabs(bootstrap("root", "Root"), new EventTarget());
            const press = (id: string, init: MouseEventInit, type = "click") => {
                const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
                document.querySelector(`[data-note-id="${id}"] span`)?.dispatchEvent(event);
                return event.defaultPrevented;
            };

            expect(press("n2", { button: 0 })).toBe(false);
            expect(tabTitles()).toEqual([ "Root" ]);

            expect(press("n2", { button: 0, metaKey: true })).toBe(true);
            expect(press("n3", { button: 1 }, "auxclick")).toBe(true);
            // A note can have more than one tab.
            expect(press("n2", { button: 0, ctrlKey: true })).toBe(true);
            expect(tabTitles()).toEqual([ "Root", "Two", "Three", "Two" ]);
            expect(document.querySelector(".collab-tab.active .collab-tab-title")?.textContent)
                .toBe("Root");
            expect(document.querySelectorAll(".collab-tab-icon")[1]?.className)
                .toBe("collab-tab-icon bx bx-file");
        });

    it("marks the very tab that was opened as active, of a note's several", () => {
        sessionStorage.setItem("collab-tabs:c1", JSON.stringify([
            { noteId: "root", title: "Root" }, { noteId: "n2", title: "Two" },
            { noteId: "n2", title: "Two" }
        ]));
        document.body.innerHTML = `<div id="right-pane"><div id="main"></div></div>`;
        const events = new EventTarget();
        const page = bootstrap("root", "Root");
        setupTabs(page, events);
        const active = () => [ ...document.querySelectorAll(".collab-tab") ]
            .map((tab) => tab.classList.contains("active"));
        // The page does not follow the link here; the guest page's navigation does.
        const stay = (event: Event) => event.preventDefault();
        document.addEventListener("click", stay);

        document.querySelectorAll<HTMLElement>(".collab-tab")[2]?.click();
        page.noteId = "n2";
        events.dispatchEvent(new CustomEvent("collab-navigated", {
            detail: { navigation: "push" }
        }));
        expect(active()).toEqual([ false, false, true ]);

        // A rename reaches every tab of the note.
        events.dispatchEvent(new CustomEvent("collab-update", {
            detail: { notes: [ { noteId: "n2", title: "Deux" } ] }
        }));
        expect(tabTitles()).toEqual([ "Root", "Deux", "Deux" ]);

        // The next page load keeps the same tab active.
        document.body.innerHTML = `<div id="right-pane"><div id="main"></div></div>`;
        setupTabs(bootstrap("n2", "Deux"), new EventTarget());
        expect(active()).toEqual([ false, false, true ]);
        document.removeEventListener("click", stay);
    });

    it("shows no tabs without a subtree", () => {
        document.body.innerHTML = `<div id="main"></div>`;
        setupTabs({ ...bootstrap("root", "Root"), includeSubtree: false }, new EventTarget());
        expect(document.querySelector(".collab-tabs")).toBeNull();
    });
});

describe("advanceHistory", () => {
    it("follows the browser's own history of the collaboration's pages", () => {
        let history = advanceHistory({ entries: [], index: -1 }, "/a", "navigate");
        history = advanceHistory(history, "/b", "navigate");
        expect(history).toEqual({ entries: [ "/a", "/b" ], index: 1 });

        expect(advanceHistory(history, "/b", "reload")).toBe(history);
        expect(advanceHistory(history, "/b", "navigate")).toBe(history);

        const back = advanceHistory(history, "/a", "back_forward");
        expect(back).toEqual({ entries: [ "/a", "/b" ], index: 0 });
        expect(advanceHistory(back, "/b", "back_forward")).toEqual(history);

        // A new page after going back drops what lay ahead.
        expect(advanceHistory(back, "/c", "navigate"))
            .toEqual({ entries: [ "/a", "/c" ], index: 1 });

        // Back or forward to a page it never saw, as from outside the collaboration, starts anew.
        expect(advanceHistory(history, "/z", "back_forward"))
            .toEqual({ entries: [ "/a", "/b", "/z" ], index: 2 });

        // A path seen twice resolves to the visit nearest the current one.
        const repeated = { entries: [ "/a", "/b", "/a", "/c" ], index: 3 };
        expect(advanceHistory(repeated, "/a", "back_forward").index).toBe(2);

        let long = { entries: [] as string[], index: -1 };
        for (let i = 0; i < 60; i++) {
            long = advanceHistory(long, `/${i}`, "navigate");
        }
        expect(long.entries).toHaveLength(50);
        expect(long.entries[0]).toBe("/10");
        expect(long.index).toBe(49);
    });
});

describe("tree", () => {
    const bootstrap = {
        collabId: "c1", rootNoteId: "root", noteId: "child", title: "Child", includeSubtree: true,
        capabilities: [ "view", "edit", "create" ],
        csrfToken: "token",
        strings: {}
    };

    afterEach(() => {
        vi.unstubAllGlobals();
        sessionStorage.clear();
    });

    function treeHtml(childTitle: string) {
        const row = (noteId: string, title: string, extra = "") =>
            `<a class="type-text${extra}" href="./${noteId}" data-note-id="${noteId}">`
            + `<span><i></i> ${title}</span></a>`;

        return `<ul><li class="submenu-item expanded">
            <a class="type-text" href="./" data-note-id="root"><span><i></i> Root</span>
                <button type="button" class="collab-add-button" data-note-id="root"></button></a>
            <ul>
                <li class="item">${row("child", childTitle, " active")}</li>
                <li class="submenu-item">${row("other", "Other")}<ul><li></li></ul></li>
            </ul>
        </li></ul>`;
    }

    it("adds a note under a row without asking for a title, then opens it", async () => {
        document.body.innerHTML = `<nav id="menu">${treeHtml("Child")}</nav>`;
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
            ({ ok: true, json: async () => ({ noteId: "new1", title: "New note" }) }));
        const location = { href: "" };
        vi.stubGlobal("fetch", fetchMock);
        vi.stubGlobal("location", location);
        setupAddButtons(bootstrap);

        const click = new MouseEvent("click", { bubbles: true, cancelable: true });
        document.querySelector(".collab-add-button")?.dispatchEvent(click);
        expect(click.defaultPrevented).toBe(true);

        await vi.waitFor(() => expect(location.href).toBe("./new1"));
        expect(fetchMock).toHaveBeenCalledWith("api/notes/root/children",
            expect.objectContaining({ method: "POST", body: "{}" }));
        expect(sessionStorage.getItem("collab-new-note")).toBe("new1");
    });

    it("refreshes the tree and the title row in place, keeping opened branches open", async () => {
        document.body.innerHTML = `
            <div class="collab-title-row">
                <span class="collab-note-icon tn-icon bx bx-note"
                    data-icon-class="tn-icon bx bx-note"></span>
                <h1 id="title">Child</h1>
            </div>
            <div id="content"></div>
            <nav id="menu">${treeHtml("Child")}</nav>`;
        // The guest opened "Other" by hand.
        document.querySelector('a[data-note-id="other"]')?.parentElement?.classList.add("expanded");
        const fetchMock = vi.fn(async (_url: string) => ({
            ok: true,
            json: async () => ({
                html: treeHtml("Renamed"),
                childrenHtml: `<section class="collab-note-list">
                    <div class="collab-note-card" data-note-id="grandchild"></div></section>`,
                iconClass: "tn-icon bx bx-star",
                color: "#ff0000",
                hasHue: true
            })
        }));
        vi.stubGlobal("fetch", fetchMock);
        const events = new EventTarget();
        followTreeChanges(bootstrap, events);
        const update = (detail: object) => events.dispatchEvent(new CustomEvent("collab-update", {
            detail: { treeChanged: false, settingsChanged: false, ...detail }
        }));

        // A save that leaves every title as the tree shows it changes nothing.
        update({ notes: [ { noteId: "child", title: "Child" } ] });
        expect(fetchMock).not.toHaveBeenCalled();

        update({ notes: [ { noteId: "child", title: "Renamed" } ] });
        const shownTitle = (noteId: string) =>
            document.querySelector(`a[data-note-id="${noteId}"] > span`)?.textContent?.trim();
        await vi.waitFor(() => expect(shownTitle("child")).toBe("Renamed"));
        expect(fetchMock).toHaveBeenCalledWith("api/tree-menu?active=child", expect.anything());
        const other = document.querySelector('a[data-note-id="other"]')?.parentElement;
        expect(other?.classList.contains("expanded")).toBe(true);

        const row = document.querySelector<HTMLElement>(".collab-title-row");
        const icon = row?.querySelector(".collab-note-icon");
        expect(icon?.className).toBe("collab-note-icon tn-icon bx bx-star");
        expect(row?.dataset.color).toBe("#ff0000");
        expect(row?.hasAttribute("data-color-hue")).toBe(true);
        // A child added elsewhere shows as a card under the body.
        expect(document.querySelector("#content + .collab-note-list .collab-note-card")
            ?.getAttribute("data-note-id")).toBe("grandchild");

        // The appearance controls ask for the same refresh.
        events.dispatchEvent(new CustomEvent("collab-refresh"));
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    });
});

describe("setupNoteOptions", () => {
    const base = {
        collabId: "c1", rootNoteId: "root", noteId: "n1", title: "One", includeSubtree: true,
        type: "code", mime: "text/plain", editable: true,
        codeLanguages: [
            { mime: "text/plain", title: "Plain text", runs: false },
            { mime: "text/x-python", title: "Python", runs: false }
        ],
        csrfToken: "token",
        strings: { note_type_heading: "Note type", type_text: "Text", type_code: "Code",
            type_markdown: "Markdown", type_mermaid: "Mermaid Diagram", type_canvas: "Canvas",
            type_mind_map: "Mind Map", type_book: "Collection",
            language: "Language", search_languages: "Search languages",
            language_runs: "Only the host can choose it.",
            change_color: "Change color", change_icon: "Change icon",
            add_child_note: "Add a child note", copy_link: "Copy link", download: "Download",
            print: "Print" }
    };

    function open(capabilities: string[], note: Partial<typeof base> = {}) {
        document.body.innerHTML = `<button class="collab-note-options"></button>`;
        const events = new EventTarget();
        setupNoteOptions({ ...base, ...note, capabilities }, events);
        document.querySelector<HTMLButtonElement>(".collab-note-options")?.click();
        return { events, labels: rowLabels(document.querySelector(".collab-menu")) };
    }

    /** The shown rows of a menu itself, without those of a submenu open inside it. */
    function rowsOf(menu: Element | null | undefined) {
        return [ ...menu?.querySelectorAll<HTMLButtonElement>(".collab-menu-item") ?? [] ]
            .filter((row) => row.closest(".collab-menu") === menu && !row.hidden);
    }

    function rowLabels(menu: Element | null | undefined) {
        return rowsOf(menu).map((row) => row.textContent);
    }

    function pick(menu: Element | null | undefined, label: string) {
        rowsOf(menu).find((row) => row.textContent === label)?.click();
    }

    /** Opens the submenu of the options row named `label`, and returns it. */
    function openSubmenu(label: string) {
        pick(document.querySelector(".collab-menu"), label);
        return document.querySelector<HTMLElement>(".collab-submenu");
    }

    function checkedIn(menu: Element | null | undefined) {
        return rowsOf(menu).filter((row) => row.getAttribute("aria-checked") === "true")
            .map((row) => row.textContent);
    }

    function listen(events: EventTarget) {
        const asked: unknown[] = [];
        events.addEventListener("collab-switch-type", (event) =>
            asked.push((event as CustomEvent).detail));
        return asked;
    }

    it("offers each guest what their capabilities allow, with the type and language as submenus",
        () => {
            expect(open([ "view" ]).labels).toEqual([ "Copy link", "Download", "Print" ]);
            expect(open([ "view", "edit", "create" ]).labels).toEqual([
                "Note type", "Language", "Change color", "Change icon", "Add a child note",
                "Copy link", "Download", "Print"
            ]);
            expect(rowLabels(openSubmenu("Note type"))).toEqual([
                "Text", "Collection", "Canvas", "Mermaid Diagram", "Mind Map", "Code", "Markdown"
            ]);
        });

    it("marks the note's type and language, and asks the editor to switch", () => {
        const { events } = open([ "view", "edit" ]);
        expect(checkedIn(openSubmenu("Note type"))).toEqual([ "Code" ]);
        const languages = openSubmenu("Language");
        expect(checkedIn(languages)).toEqual([ "Plain text" ]);

        const asked = listen(events);
        pick(languages, "Python");
        expect(asked).toEqual([ { type: "code", mime: "text/x-python" } ]);
        // Picking closes the menu.
        expect(document.querySelector(".collab-menu")).toBeNull();
    });

    it("narrows the languages to what the guest types, ticking the note's own", () => {
        const { events } = open([ "view", "edit" ], {
            mime: "text/x-rustsrc",
            codeLanguages: [
                { mime: "text/plain", title: "Plain text", runs: false },
                { mime: "text/jsx", title: "JSX", runs: true },
                { mime: "text/x-python", title: "Python", runs: false },
                { mime: "text/x-rustsrc", title: "Rust", runs: false },
                { mime: "text/x-ruby", title: "Ruby", runs: false }
            ]
        });
        const languages = openSubmenu("Language");
        const search = languages?.querySelector<HTMLInputElement>(".collab-menu-search");

        expect(search?.getAttribute("aria-label")).toBe("Search languages");
        expect(rowLabels(languages)).toEqual([ "Plain text", "JSX", "Python", "Rust", "Ruby" ]);
        expect(checkedIn(languages)).toEqual([ "Rust" ]);
        // Listed as the app lists it, but only the host can give a note a language Trilium runs.
        const jsx = rowsOf(languages).find((row) => row.textContent === "JSX");
        expect(jsx?.getAttribute("aria-disabled")).toBe("true");
        expect(jsx?.title).toBe("Only the host can choose it.");

        if (search) {
            search.value = " RU ";
            search.dispatchEvent(new Event("input"));
        }
        expect(rowLabels(languages)).toEqual([ "Rust", "Ruby" ]);

        // Enter takes the first language left.
        const asked = listen(events);
        search?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        expect(asked).toEqual([ { type: "code", mime: "text/x-rustsrc" } ]);
    });

    it("ticks Markdown apart from Code, and switches to the drawn types with their mimes", () => {
        const markdown = open([ "view", "edit" ], { type: "code", mime: "text/x-markdown" });
        // A Markdown note is a type of its own, without the language list.
        expect(markdown.labels).not.toContain("Language");
        expect(checkedIn(openSubmenu("Note type"))).toEqual([ "Markdown" ]);

        const asked: unknown[] = [];
        for (const label of [ "Mind Map", "Collection", "Mermaid Diagram" ]) {
            const { events } = open([ "view", "edit" ], {
                type: "canvas", mime: "application/json"
            });
            const types = openSubmenu("Note type");
            expect(checkedIn(types)).toEqual([ "Canvas" ]);
            events.addEventListener("collab-switch-type", (event) =>
                asked.push((event as CustomEvent).detail));
            pick(types, label);
        }
        expect(asked).toEqual([
            { type: "mindMap", mime: "application/json" },
            { type: "book", mime: "" },
            { type: "mermaid", mime: "text/mermaid" }
        ]);
    });
});

describe("in-place navigation", () => {
    interface PageNote {
        id: string;
        title: string;
        icon?: string;
        color?: string;
        cards?: boolean;
        toc?: boolean;
        capabilities?: string[];
    }

    const base = {
        collabId: "c1", rootNoteId: "root", includeSubtree: true, csrfToken: null,
        capabilities: [ "view" ], strings: {}
    };

    function treeRow(id: string, title: string, activeId: string) {
        const active = id === activeId ? " active" : "";
        const href = id === "root" ? "./" : `./${id}`;
        return `<a class="type-text${active}" href="${href}" data-note-id="${id}">`
            + `<span><i></i> ${title}</span></a>`;
    }

    function pageHtml(note: PageNote) {
        const icon = note.icon ?? "bx bx-note";
        const color = note.color
            ? ` data-color="${note.color}" style="--note-color: ${note.color}"`
            : "";
        const bootstrap = {
            ...base, noteId: note.id, title: note.title, type: "text",
            capabilities: note.capabilities ?? base.capabilities
        };
        const cards = note.cards
            ? `<section class="collab-note-list"><div class="collab-note-card"></div></section>`
            : "";
        const contents = note.toc
            ? `<div id="toc-pane"><ul id="toc"><li><a href="#x">X</a></li></ul></div>`
            : "";
        return `<!doctype html><html><head><title>${note.title} - Root</title>
            <script type="application/json" id="collab-bootstrap">
                ${JSON.stringify(bootstrap)}</script>
            </head><body data-note-id="${note.id}" class="collab type-text">
            <nav id="collab-launcher"><div class="collab-launcher-bottom">
                <button id="toc-pane-toggle-button"${note.toc ? "" : " hidden"}></button>
            </div></nav>
            <div id="left-pane"><nav id="menu"><ul><li class="submenu-item expanded">
                ${treeRow("root", "Root", note.id)}
                <ul><li class="item">${treeRow("n1", "One", note.id)}</li>
                <li class="item">${treeRow("n2", "Two", note.id)}</li></ul>
            </li></ul></nav></div>
            <div id="right-pane"><div id="main">
                <header class="collab-note-header"><div class="collab-title-row"${color}>
                    <span class="collab-note-icon ${icon}" data-icon-class="${icon}"></span>
                    <h1 id="title">${note.title}</h1></div>
                    <div class="collab-note-info"><span>Type: text</span></div></header>
                <div id="content"><p>${note.title} body</p></div>
                ${cards}
                <footer id="content-footer"><div class="updated">${note.title} footer</div></footer>
            </div>${contents}</div>
            </body></html>`;
    }

    function show(note: PageNote) {
        const doc = new DOMParser().parseFromString(pageHtml(note), "text/html");
        document.documentElement.replaceChildren(
            document.importNode(doc.head, true), document.importNode(doc.body, true));
        const path = note.id === "root" ? "/collab/c1/" : `/collab/c1/${note.id}`;
        history.replaceState(null, "", path);
    }

    function serve(status: number, note?: PageNote) {
        const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
            ({ ok: status === 200, status, text: async () => (note ? pageHtml(note) : "") }));
        vi.stubGlobal("fetch", fetchMock);
        return fetchMock;
    }

    const teardowns: (() => void)[] = [];

    function start(bootstrap: Record<string, unknown>) {
        const events = new EventTarget();
        const navigated: unknown[] = [];
        events.addEventListener("collab-navigated", (event) =>
            navigated.push((event as CustomEvent).detail));
        const load = vi.fn();
        const typed = bootstrap as unknown as Parameters<typeof setupNavigation>[0];
        teardowns.push(setupNavigation(typed, events, load));
        return { navigated, load, events };
    }

    function click(noteId: string) {
        document.querySelector<HTMLAnchorElement>(`#menu a[data-note-id="${noteId}"]`)?.click();
    }

    afterEach(() => {
        for (const teardown of teardowns.splice(0)) teardown();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("takes links to the collaboration's notes and leaves every other link alone", () => {
        show({ id: "n1", title: "One" });
        const target = new URL("http://localhost:3000/collab/c1/");
        const link = (href: string, extra: Record<string, string> = {}) => {
            const element = document.createElement("a");
            element.setAttribute("href", href);
            for (const [ name, value ] of Object.entries(extra)) element.setAttribute(name, value);
            return element;
        };

        expect(collabNoteTarget(link("./n2"), target)?.pathname).toBe("/collab/c1/n2");
        expect(collabNoteTarget(link("./"), target)?.pathname).toBe("/collab/c1/");
        for (const href of [ "api/notes/n1/download", "login", "logout", "#heading",
            "https://example.com/collab/c1/n2", "/collab/c2/n1", "/share/n1" ]) {
            expect(collabNoteTarget(link(href), target), href).toBeNull();
        }
        expect(collabNoteTarget(link("./n2", { target: "_blank" }), target)).toBeNull();
        expect(collabNoteTarget(link("./n2", { download: "" }), target)).toBeNull();
    });

    it("switches a viewer to another note in place, swapping what differs", async () => {
        show({ id: "n1", title: "One" });
        const fetchMock = serve(200, {
            id: "n2", title: "Two", icon: "bx bx-star", color: "#ff0000", cards: true, toc: true
        });
        const push = vi.spyOn(history, "pushState");
        const bootstrap = { ...base, noteId: "n1", title: "One" };
        const { navigated, load } = start(bootstrap);

        click("n2");
        await vi.waitFor(() => expect(navigated).toHaveLength(1));

        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3000/collab/c1/n2");
        expect(load).not.toHaveBeenCalled();
        expect(push).toHaveBeenCalledWith(null, "", "http://localhost:3000/collab/c1/n2");
        expect(navigated[0]).toEqual({ navigation: "navigate" });
        expect(bootstrap).toMatchObject({ noteId: "n2", title: "Two" });
        expect(document.title).toBe("Two - Root");
        expect(document.body.dataset.noteId).toBe("n2");
        expect(document.getElementById("title")?.textContent).toBe("Two");
        expect(document.querySelector(".collab-note-icon")?.className).toContain("bx-star");
        expect(document.querySelector(".collab-title-row")?.getAttribute("data-color"))
            .toBe("#ff0000");
        expect(document.getElementById("content")?.textContent).toContain("Two body");
        expect(document.querySelector(".collab-note-list")).not.toBeNull();
        expect(document.getElementById("content-footer")?.textContent).toContain("Two footer");
        expect(document.getElementById("toc-pane")).not.toBeNull();
        expect(document.getElementById("toc-pane-toggle-button")?.hidden).toBe(false);
        expect(document.querySelector("#menu a.active")?.getAttribute("data-note-id")).toBe("n2");

        // And back to a note without cards or contents.
        serve(200, { id: "n1", title: "One" });
        click("n1");
        await vi.waitFor(() => expect(navigated).toHaveLength(2));
        expect(document.querySelector(".collab-note-list")).toBeNull();
        expect(document.getElementById("toc-pane")).toBeNull();
        expect(document.getElementById("toc-pane-toggle-button")?.hidden).toBe(true);
    });

    it("loads the page normally when it cannot switch in place", async () => {
        show({ id: "n1", title: "One" });
        serve(401);
        const viewer = start({ ...base, noteId: "n1", title: "One" });
        click("n2");
        await vi.waitFor(() => expect(viewer.load).toHaveBeenCalledWith(
            "http://localhost:3000/collab/c1/n2"));
        expect(document.getElementById("title")?.textContent).toBe("One");
        for (const teardown of teardowns.splice(0)) teardown();

        // An editor whose editor cannot take the next note.
        show({ id: "n1", title: "One" });
        serve(200, { id: "n2", title: "Two", capabilities: [ "view", "edit" ] });
        const switchNote = vi.fn(async () => false);
        const editor = start({
            ...base, noteId: "n1", title: "One", capabilities: [ "view", "edit" ],
            csrfToken: "token", switchNote
        });
        click("n2");
        await vi.waitFor(() => expect(editor.load).toHaveBeenCalled());
        expect(switchNote).toHaveBeenCalledWith(expect.objectContaining({ noteId: "n2" }));
        expect(document.getElementById("title")?.textContent).toBe("One");
        for (const teardown of teardowns.splice(0)) teardown();

        // A note whose page now offers the guest editing, which only a page load sets up.
        show({ id: "n1", title: "One" });
        serve(200, { id: "n2", title: "Two", capabilities: [ "view", "edit" ] });
        const unlocked = start({ ...base, noteId: "n1", title: "One" });
        click("n2");
        await vi.waitFor(() => expect(unlocked.load).toHaveBeenCalledWith(
            "http://localhost:3000/collab/c1/n2"));
        expect(document.getElementById("title")?.textContent).toBe("One");
    });

    it("refreshes a viewer's note in place, keeping its scroll, panes and history", async () => {
        show({ id: "n1", title: "One" });
        const fetchMock = serve(200, { id: "n1", title: "One again" });
        const push = vi.spyOn(history, "pushState");
        const bootstrap = { ...base, noteId: "n1", title: "One" };
        const { navigated, load, events } = start(bootstrap);
        const reload = vi.fn();
        followPageChanges(
            bootstrap as unknown as Parameters<typeof followPageChanges>[0], events, reload);
        const pane = document.getElementById("right-pane");
        if (!pane) throw new Error("fixture");
        const scrollTo = vi.fn();
        pane.scrollTo = scrollTo;
        document.body.classList.add("menu-open");
        const update = (detail: Record<string, unknown>) => events.dispatchEvent(
            new CustomEvent("collab-update", {
                detail: { notes: [], treeChanged: false, settingsChanged: false, ...detail }
            }));

        // Another note's change leaves the page alone; changes before the refresh starts share it.
        update({ notes: [ { noteId: "n2", title: "Two" } ] });
        update({ notes: [ { noteId: "n1", title: "One again" } ] });
        update({ notes: [ { noteId: "n1", title: "One again" } ] });
        await vi.waitFor(() => expect(document.getElementById("content")?.textContent)
            .toContain("One again body"));

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:3000/collab/c1/n1");
        expect(document.getElementById("title")?.textContent).toBe("One again");
        expect(bootstrap.title).toBe("One again");
        expect(reload).not.toHaveBeenCalled();
        expect(load).not.toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
        expect(navigated).toEqual([]);
        expect(scrollTo).not.toHaveBeenCalled();
        expect(document.body.classList.contains("menu-open")).toBe(true);

        // A change to what the collaboration offers loads the page again.
        update({ settingsChanged: true });
        expect(reload).toHaveBeenCalledOnce();
    });

    it("follows the browser's back and forward in place, without pushing", async () => {
        show({ id: "n1", title: "One" });
        serve(200, { id: "n2", title: "Two" });
        const push = vi.spyOn(history, "pushState");
        const { navigated } = start({ ...base, noteId: "n1", title: "One" });

        // The browser has already moved to the entry it went back or forward to.
        history.replaceState(null, "", "/collab/c1/n2");
        window.dispatchEvent(new PopStateEvent("popstate"));
        await vi.waitFor(() => expect(navigated).toEqual([ { navigation: "back_forward" } ]));
        expect(push).not.toHaveBeenCalled();
        expect(document.getElementById("title")?.textContent).toBe("Two");
    });

    it("adds the new note's tab and updates back and forward after a switch", () => {
        sessionStorage.clear();
        document.body.innerHTML = `<div id="main"></div>`;
        history.replaceState(null, "", "/collab/c1/n1");
        const bootstrap = { ...base, noteId: "n1", title: "One", strings: { back: "Back" } };
        const events = new EventTarget();
        setupTabs(bootstrap, events);
        const [ back, forward ] =
            [ ...document.querySelectorAll<HTMLButtonElement>(".collab-history-button") ];
        const navigated = (navigation: string) => events.dispatchEvent(
            new CustomEvent("collab-navigated", { detail: { navigation } }));
        expect([ back.disabled, forward.disabled ]).toEqual([ true, true ]);

        history.replaceState(null, "", "/collab/c1/n2");
        Object.assign(bootstrap, { noteId: "n2", title: "Two" });
        navigated("navigate");
        expect([ ...document.querySelectorAll(".collab-tab-title") ].map((tab) => tab.textContent))
            .toEqual([ "One", "Two" ]);
        expect(document.querySelector(".collab-tab.active .collab-tab-title")?.textContent)
            .toBe("Two");
        expect([ back.disabled, forward.disabled ]).toEqual([ false, true ]);

        history.replaceState(null, "", "/collab/c1/n1");
        Object.assign(bootstrap, { noteId: "n1", title: "One" });
        navigated("back_forward");
        expect([ back.disabled, forward.disabled ]).toEqual([ true, false ]);
    });
});

describe("connectGuestSocket", () => {
    class FakeSocket {

        static readonly OPEN = 1;
        static instances: FakeSocket[] = [];
        readyState = 0;
        sent: string[] = [];
        onopen?: () => void;
        onclose?: (event: { code: number }) => void;

        constructor(readonly url: string) {
            FakeSocket.instances.push(this);
        }

        send(data: string) {
            this.sent.push(data);
        }

    }

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        FakeSocket.instances = [];
    });

    it("connects once joined, and never again once the host removed the guest", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("WebSocket", FakeSocket);
        document.body.innerHTML = `<div id="left-pane"></div><div id="main"></div>`;
        let join = () => {};
        const ready = new Promise<void>((resolve) => {
            join = resolve;
        });
        const events = new EventTarget();
        const removed = vi.fn();
        events.addEventListener("collab-removed", removed);
        const target = {
            collabId: "c1", rootNoteId: "root", noteId: "n1", title: "One", includeSubtree: true,
            capabilities: [ "view" ], csrfToken: null, strings: { removed: "You were removed." }
        };

        const send = connectGuestSocket(target, events, ready);
        expect(FakeSocket.instances).toHaveLength(0);
        join();
        await ready;
        expect(FakeSocket.instances.map((socket) => new URL(socket.url).search))
            .toEqual([ "?collab=c1" ]);

        const first = FakeSocket.instances[0];
        first.readyState = FakeSocket.OPEN;
        first.onopen?.();
        send({ type: "collab-viewing", noteId: "n1" });
        expect(first.sent).toEqual([ JSON.stringify({ type: "collab-viewing", noteId: "n1" }) ]);

        // A dropped connection comes back by itself.
        first.onclose?.({ code: 1006 });
        vi.advanceTimersByTime(2000);
        expect(FakeSocket.instances).toHaveLength(2);

        FakeSocket.instances[1].onclose?.({ code: 4401 });
        expect(removed).toHaveBeenCalledTimes(1);
        expect(document.querySelector(".collab-notice")?.textContent).toBe("You were removed.");
        expect([ "left-pane", "main" ]
            .map((id) => document.getElementById(id)?.hasAttribute("inert")))
            .toEqual([ true, true ]);
        vi.advanceTimersByTime(120_000);
        expect(FakeSocket.instances).toHaveLength(2);
    });
});
