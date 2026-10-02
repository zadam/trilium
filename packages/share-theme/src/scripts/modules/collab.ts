import type { CollabPerson } from "@triliumnext/commons/src/lib/collab.js";

import { loadClientEntry } from "./client_entry.js";
import { ensureJoined, setupPeople } from "./collab_people.js";
import setupExpanders from "./expanders.js";
import setupFaviconContrast from "./favicon_contrast.js";
import setupMath from "./math.js";
import { buildMenu, type MenuRow, placeMenu } from "./menu.js";
import setupMermaid from "./mermaid.js";
import setupToC from "./toc.js";
import setupVideoFacades from "./video_facade.js";

/** The part of `window.collab` this module reads; the client's entry reads the rest. */
interface CollabBootstrap {
    collabId: string;
    rootNoteId: string;
    noteId: string;
    title: string;
    iconClass?: string;
    type?: string;
    mime?: string;
    editable?: boolean;
    /** The app's list for code notes; the ones Trilium runs are the host's alone to choose. */
    codeLanguages?: { mime: string; title: string; runs?: boolean }[];
    includeSubtree: boolean;
    capabilities: string[];
    csrfToken: string | null;
    /** The page's own person in the list of people, or null until the page joined. */
    selfId?: string | null;
    strings: Record<string, string>;
    /** Set here: who is on the collaboration's pages, from the last presence. */
    people?: CollabPerson[];
    /** Set here: the server's live messages, dispatched as `CustomEvent`s named by message type. */
    events?: EventTarget;
    /** Set here: sends a message over the guest socket while it is open. */
    send?: (message: object) => void;
    /** Set here: opens another of the collaboration's notes, in place where the page can. */
    navigate?: (href: string) => void;
    /** Set here: shows the latest version of the open note, in place where the page can. */
    refresh?: () => void;
    /**
     * Set by the guest editor: saves the open note and loads `next` into the same editor.
     * Resolves `false` when the editor cannot take that note, and the page then loads normally.
     */
    switchNote?: (next: CollabBootstrap) => Promise<boolean>;
}

interface CollabUpdate {
    notes: { noteId: string; title?: string; type?: string }[];
    treeChanged: boolean;
    settingsChanged: boolean;
}

type MountGuestEditor = (bootstrap: CollabBootstrap) => Promise<void>;

/** Names the note "+" just created, so its page selects the title; matches `guest_title.ts`. */
const NEW_NOTE_KEY = "collab-new-note";

/** The close code of a socket the collaboration has no seat for; matches `guest_socket.ts`. */
const COLLAB_FULL_CLOSE_CODE = 4503;
/** The close code of a guest's sockets once the host removed them; matches `guest_socket.ts`. */
const COLLAB_REMOVED_CLOSE_CODE = 4401;
const FULL_RETRY_DELAY = 15000;

declare global {
    interface Window {
        collab?: CollabBootstrap;
    }
}

/**
 * Connects a collaboration page to the server: live updates and presence for every guest, and
 * the client's guest editor for one who can edit. The tree, and a viewer's note, refresh in place.
 */
export default async function setupCollab() {
    const bootstrap = window.collab;

    if (!bootstrap) {
        return;
    }

    const events = new EventTarget();
    bootstrap.events = events;
    bootstrap.send = connectGuestSocket(bootstrap, events, ensureJoined(bootstrap));

    // Every page says which note it shows, for the list of people and their carets.
    const announceView = () =>
        bootstrap.send?.({ type: "collab-viewing", noteId: bootstrap.noteId });
    events.addEventListener("collab-open", announceView);
    events.addEventListener("collab-navigated", announceView);
    events.addEventListener("collab-presence", (event) => {
        bootstrap.people = (event as CustomEvent<{ people: CollabPerson[] }>).detail.people;
    });

    const canEdit = hasEditor(bootstrap);
    ensureHeader();
    setupPeople(bootstrap, events);
    setupTabs(bootstrap, events);
    setupAddButtons(bootstrap);
    setupNoteOptions(bootstrap, events);
    followTreeChanges(bootstrap, events);
    setupNavigation(bootstrap, events);

    if (canEdit) {
        const mount = await loadClientEntry<MountGuestEditor>("collab_editor");
        await mount(bootstrap);
        return;
    }

    followPageChanges(bootstrap, events);
}

/**
 * Keeps a viewer's page current: a change to the shown note refreshes it in place, and a change
 * to what the collaboration offers loads the page again.
 */
export function followPageChanges(
    bootstrap: CollabBootstrap, events: EventTarget, reload = () => location.reload()
) {
    events.addEventListener("collab-update", (event) => {
        const update = (event as CustomEvent<CollabUpdate>).detail;

        if (update.settingsChanged) {
            reload();
        } else if (update.notes.some((note) => note.noteId === bootstrap.noteId)) {
            bootstrap.refresh?.();
        }
    });
}

/** Whether the page runs the guest editor, which needs the capability and a session's token. */
function hasEditor(bootstrap: CollabBootstrap) {
    return bootstrap.capabilities.includes("edit") && !!bootstrap.csrfToken;
}

interface CollabTab {
    noteId: string;
    title: string;
    iconClass?: string;
}

/**
 * The notes opened in this browser session, as a tab bar over the content, kept in session
 * storage so the next page load shows the same tabs. Only a subtree has notes to switch between.
 */
export function setupTabs(bootstrap: CollabBootstrap, events: EventTarget) {
    if (!bootstrap.includeSubtree) {
        return;
    }

    const key = `collab-tabs:${bootstrap.collabId}`;
    const tabs = readTabs(key);
    const current = tabs.find((tab) => tab.noteId === bootstrap.noteId);

    if (current) {
        current.title = bootstrap.title;
        current.iconClass = bootstrap.iconClass;
    } else {
        tabs.push({
            noteId: bootstrap.noteId, title: bootstrap.title, iconClass: bootstrap.iconClass
        });
    }

    const bar = document.createElement("nav");
    bar.className = "collab-tabs";
    bar.setAttribute("aria-label", bootstrap.strings.tabs ?? "");

    const render = () => {
        writeTabs(key, tabs);
        bar.replaceChildren(...tabs.map((tab) => {
            const link = document.createElement("a");
            link.className = `collab-tab${tab.noteId === bootstrap.noteId ? " active" : ""}`;
            link.href = noteUrl(bootstrap.rootNoteId, tab.noteId);
            const icon = document.createElement("span");
            icon.className = `collab-tab-icon ${tab.iconClass ?? "bx bx-note"}`;
            const title = document.createElement("span");
            title.className = "collab-tab-title";
            title.textContent = tab.title;
            link.append(icon, title);

            if (tabs.length > 1) {
                const close = document.createElement("button");
                close.type = "button";
                close.className = "collab-tab-close bx bx-x";
                close.title = bootstrap.strings.close_tab ?? "";
                close.setAttribute("aria-label", bootstrap.strings.close_tab ?? "");
                close.addEventListener("click", (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const index = tabs.indexOf(tab);
                    tabs.splice(index, 1);
                    writeTabs(key, tabs);

                    if (tab.noteId === bootstrap.noteId) {
                        const next = tabs[Math.min(index, tabs.length - 1)];
                        openNote(bootstrap, noteUrl(bootstrap.rootNoteId, next.noteId));
                        return;
                    }

                    render();
                });
                link.append(close);
            }

            return link;
        }));
    };

    render();

    const pageHistory = createHistoryButtons(bootstrap);
    const row = document.createElement("div");
    row.className = "collab-tab-row";
    row.append(...pageHistory.buttons, bar);
    ensureHeader()?.append(row);

    // A note opened in place: its tab, and where it stands among the pages seen.
    events.addEventListener("collab-navigated", (event) => {
        const { navigation } = (event as CustomEvent<{ navigation: string }>).detail;
        pageHistory.record(location.pathname, navigation);
        const tab = tabs.find((candidate) => candidate.noteId === bootstrap.noteId);

        if (tab) {
            tab.title = bootstrap.title;
            tab.iconClass = bootstrap.iconClass;
        } else {
            tabs.push({
                noteId: bootstrap.noteId, title: bootstrap.title, iconClass: bootstrap.iconClass
            });
        }

        render();
    });

    // A note renamed elsewhere keeps its tab's title current.
    events.addEventListener("collab-update", (event) => {
        const update = (event as CustomEvent<CollabUpdate>).detail;
        let changed = false;

        for (const note of update.notes) {
            const tab = tabs.find((candidate) => candidate.noteId === note.noteId);

            if (tab && typeof note.title === "string" && tab.title !== note.title) {
                tab.title = note.title;
                changed = true;
            }
        }

        if (changed) {
            render();
        }
    });
    // The shown note's new icon, from a refresh of the page.
    events.addEventListener("collab-appearance", (event) => {
        const { iconClass } = (event as CustomEvent<{ iconClass: string }>).detail;
        const tab = tabs.find((candidate) => candidate.noteId === bootstrap.noteId);

        if (tab && tab.iconClass !== iconClass) {
            tab.iconClass = iconClass;
            render();
        }
    });
}

function readTabs(key: string): CollabTab[] {
    try {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? "[]") as unknown;

        return Array.isArray(stored)
            ? stored.filter((tab): tab is CollabTab =>
                !!tab && typeof tab.noteId === "string" && typeof tab.title === "string"
                && (tab.iconClass === undefined || typeof tab.iconClass === "string"))
            : [];
    } catch {
        return [];
    }
}

interface PageHistory {
    /** The paths of the collaboration's pages this browser tab went through, oldest first. */
    entries: string[];
    index: number;
}

const MAX_HISTORY = 50;

/**
 * Where a page load leaves the browser tab's history of this collaboration's pages: a reload stays,
 * the browser's back and forward move along it, and any other navigation drops what lay ahead of
 * the current page, as the browser's own history does.
 */
export function advanceHistory(
    history: PageHistory, path: string, navigation: string
): PageHistory {
    const { entries, index } = history;

    if (entries[index] === path && navigation !== "navigate") {
        return history;
    }

    if (navigation === "back_forward") {
        const nearest = entries
            .map((entry, position) => (entry === path ? position : -1))
            .filter((position) => position >= 0)
            .sort((a, b) => Math.abs(a - index) - Math.abs(b - index))[0];

        if (nearest !== undefined) {
            return { entries, index: nearest };
        }
    }

    if (entries[index] === path) {
        return history;
    }

    const kept = [ ...entries.slice(0, index + 1), path ].slice(-MAX_HISTORY);

    return { entries: kept, index: kept.length - 1 };
}

/**
 * Back and forward through this browser tab's pages of the collaboration, as the app's buttons.
 * `record` notes a page reached in place; the page load is recorded here.
 */
function createHistoryButtons(bootstrap: CollabBootstrap) {
    const key = `collab-history:${bootstrap.collabId}`;
    const back = historyButton("bx bxs-chevron-left", bootstrap.strings.back ?? "",
        () => window.history.back());
    const forward = historyButton("bx bxs-chevron-right", bootstrap.strings.forward ?? "",
        () => window.history.forward());

    const record = (path: string, navigation: string) => {
        const history = advanceHistory(readHistory(key), path, navigation);

        try {
            sessionStorage.setItem(key, JSON.stringify(history));
        } catch {
            // Without storage, the buttons only know this page.
        }

        back.disabled = history.index <= 0;
        forward.disabled = history.index >= history.entries.length - 1;
    };

    const timing = performance.getEntriesByType?.("navigation")[0] as
        PerformanceNavigationTiming | undefined;
    record(location.pathname, timing?.type ?? "navigate");

    return { buttons: [ back, forward ], record };
}

function historyButton(icon: string, label: string, go: () => void) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `collab-history-button ${icon}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", go);

    return button;
}

function readHistory(key: string): PageHistory {
    try {
        const stored = JSON.parse(sessionStorage.getItem(key) ?? "null") as
            Partial<PageHistory> | null;

        if (Array.isArray(stored?.entries) && typeof stored.index === "number"
                && stored.entries.every((entry) => typeof entry === "string")) {
            return { entries: stored.entries, index: stored.index };
        }
    } catch {
        // Unreadable storage starts the history afresh.
    }

    return { entries: [], index: -1 };
}

/** The sticky header at the top of the page: the tab row, and the editor's toolbar under it. */
function ensureHeader(): HTMLElement | null {
    const existing = document.getElementById("collab-header");
    const main = document.getElementById("main");

    if (existing || !main) {
        return existing;
    }

    const header = document.createElement("div");
    header.id = "collab-header";
    main.prepend(header);

    return header;
}

function insertBelowHeader(element: HTMLElement) {
    const header = ensureHeader();

    if (header) {
        header.after(element);
    } else {
        document.getElementById("main")?.prepend(element);
    }
}

/** A note's page within the collaboration; the root note's page is the collaboration's own. */
function noteUrl(rootNoteId: string, noteId: string) {
    return noteId === rootNoteId ? "./" : `./${encodeURIComponent(noteId)}`;
}

function writeTabs(key: string, tabs: CollabTab[]) {
    try {
        sessionStorage.setItem(key, JSON.stringify(tabs));
    } catch {
        // Storage can be unavailable; the bar then lives for this page only.
    }
}

/**
 * The "+" on each tree row: creates a note under that row, named as the app names a new note, and
 * opens it with the title selected for typing. Bound on the tree, so a refreshed tree keeps it.
 */
export function setupAddButtons(bootstrap: CollabBootstrap) {
    const csrfToken = bootstrap.csrfToken;
    const menu = document.getElementById("menu");

    if (!csrfToken || !menu) {
        return;
    }

    menu.addEventListener("click", async (event) => {
        const button = (event.target as Element).closest<HTMLButtonElement>(".collab-add-button");
        const parentNoteId = button?.dataset.noteId;

        if (!button || !parentNoteId) {
            return;
        }

        // The button sits inside the row's link, which must not navigate.
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;

        if (!await createChildNote(bootstrap, csrfToken, parentNoteId)) {
            button.disabled = false;
        }
    });
}

/**
 * Creates a note under `parentNoteId`, named as the app names a new note, and opens it with the
 * title selected for typing. Resolves `false` when the server refuses.
 */
async function createChildNote(
    bootstrap: CollabBootstrap, csrfToken: string, parentNoteId: string
) {
    const response = await fetch(`api/notes/${encodeURIComponent(parentNoteId)}/children`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: "{}"
    });

    if (!response.ok) {
        return false;
    }

    const created = await response.json() as { noteId: string };

    try {
        sessionStorage.setItem(NEW_NOTE_KEY, created.noteId);
    } catch {
        // Without storage, the new page opens without its title selected.
    }

    openNote(bootstrap, noteUrl(bootstrap.rootNoteId, created.noteId));

    return true;
}

/** Opens another of the collaboration's notes, in place where the page can. */
function openNote(bootstrap: CollabBootstrap, href: string) {
    if (bootstrap.navigate) {
        bootstrap.navigate(href);
    } else {
        location.href = href;
    }
}

/**
 * The note's options, from the "…" beside its title, as the app's note menu offers them: the
 * note's type, icon and color for a guest who can edit, a new child note for one who can add
 * notes, and a link, a download and printing for every guest. The guest editor carries out the
 * type, icon and color changes, which the menu asks for through the page's events.
 */
export function setupNoteOptions(bootstrap: CollabBootstrap, events: EventTarget) {
    const button = document.querySelector<HTMLButtonElement>(".collab-note-options");

    if (!button) {
        return;
    }

    let menu: HTMLElement | null = null;
    const close = () => {
        menu?.remove();
        menu = null;
        button.setAttribute("aria-expanded", "false");
    };

    button.addEventListener("click", () => {
        if (menu) {
            close();
            return;
        }

        const rect = button.getBoundingClientRect();
        menu = buildOptionsMenu(bootstrap, events, { x: rect.right, y: rect.bottom }, close);
        document.body.append(menu);
        placeMenu(menu, rect);
        button.setAttribute("aria-expanded", "true");
        menu.querySelector<HTMLButtonElement>(".collab-menu-item")?.focus();
    });
    document.addEventListener("pointerdown", (event) => {
        const target = event.target as Node;

        if (menu && !menu.contains(target) && !button.contains(target)) {
            close();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            close();
        }
    });
}

/** The types a guest can switch a note to, in the app's order, with the app's names and icons. */
const GUEST_NOTE_TYPES = [
    { type: "text", mime: "text/html", icon: "bx bx-note", label: "type_text" },
    { type: "book", mime: "", icon: "bx bx-book", label: "type_book" },
    { type: "canvas", mime: "application/json", icon: "bx bx-pen", label: "type_canvas" },
    { type: "mermaid", mime: "text/mermaid", icon: "bx bx-selection", label: "type_mermaid" },
    { type: "mindMap", mime: "application/json", icon: "bx bx-sitemap", label: "type_mind_map" },
    { type: "code", mime: "text/plain", icon: "bx bx-code", label: "type_code" },
    { type: "code", mime: "text/x-markdown", icon: "bx bxl-markdown", label: "type_markdown" }
];

/** The mimes the app reads as Markdown, which its type menu ticks apart from Code. */
const MARKDOWN_MIMES = [ "text/markdown", "text/x-markdown", "text/x-gfm" ];

function buildOptionsMenu(
    bootstrap: CollabBootstrap, events: EventTarget, anchor: { x: number; y: number },
    close: () => void
): HTMLElement {
    const strings = bootstrap.strings;
    const csrfToken = bootstrap.csrfToken;
    const canEdit = bootstrap.capabilities.includes("edit") && !!csrfToken;
    const canCreate = bootstrap.capabilities.includes("create") && bootstrap.includeSubtree
        && !!csrfToken;
    const switchType = (type: string, mime: string) => events.dispatchEvent(
        new CustomEvent("collab-switch-type", { detail: { type, mime } }));
    const isMarkdown = bootstrap.type === "code" && MARKDOWN_MIMES.includes(bootstrap.mime ?? "");
    const rows: MenuRow[] = [];

    if (canEdit && bootstrap.editable) {
        rows.push({
            kind: "submenu",
            icon: "bx bx-file",
            label: strings.note_type_heading ?? "",
            rows: () => GUEST_NOTE_TYPES.map((entry): MenuRow => ({
                kind: "item",
                label: strings[entry.label] ?? "",
                checked: entry.type === bootstrap.type && (entry.type !== "code"
                    || MARKDOWN_MIMES.includes(entry.mime) === isMarkdown),
                run: () => switchType(entry.type, entry.mime)
            }))
        });

        const languages = bootstrap.codeLanguages ?? [];

        if (bootstrap.type === "code" && !isMarkdown && languages.length > 0) {
            rows.push({
                kind: "submenu",
                icon: "bx bx-code-curly",
                label: strings.language ?? "",
                search: strings.search_languages ?? "",
                rows: () => languages.map((language): MenuRow => ({
                    kind: "item",
                    label: language.title,
                    checked: language.mime === bootstrap.mime,
                    disabled: language.runs,
                    title: language.runs ? strings.language_runs : undefined,
                    run: () => switchType("code", language.mime)
                }))
            });
        }

        rows.push({ kind: "divider" });
    }

    if (canEdit) {
        rows.push({
            kind: "item",
            icon: "bx bx-palette",
            label: strings.change_color ?? "",
            run: () => events.dispatchEvent(
                new CustomEvent("collab-change-color", { detail: anchor }))
        }, {
            kind: "item",
            icon: "bx bx-image",
            label: strings.change_icon ?? "",
            run: () => events.dispatchEvent(
                new CustomEvent("collab-change-icon", { detail: anchor }))
        });
    }

    if (canCreate && csrfToken) {
        rows.push({
            kind: "item",
            icon: "bx bx-plus",
            label: strings.add_child_note ?? "",
            run: () => void createChildNote(bootstrap, csrfToken, bootstrap.noteId)
        });
    }

    if (canEdit || canCreate) {
        rows.push({ kind: "divider" });
    }

    rows.push({
        kind: "item",
        icon: "bx bx-link",
        label: strings.copy_link ?? "",
        run: () => void copyLink(strings.link_copied ?? "")
    }, {
        kind: "item",
        icon: "bx bx-download",
        label: strings.download ?? "",
        run: () => download(bootstrap.noteId)
    }, {
        kind: "item",
        icon: "bx bx-printer",
        label: strings.print ?? "",
        run: () => window.print()
    });

    return buildMenu(rows, close, strings.options);
}

/** Copies the page's link, falling back to a selection where the page is not a secure context. */
async function copyLink(confirmation: string) {
    let copied = false;

    try {
        await navigator.clipboard.writeText(location.href);
        copied = true;
    } catch {
        const field = document.createElement("textarea");
        field.value = location.href;
        field.className = "collab-copy-field";
        document.body.append(field);
        field.select();
        copied = document.execCommand("copy");
        field.remove();
    }

    if (copied) {
        showToast(confirmation);
    }
}

function download(noteId: string) {
    const link = document.createElement("a");
    link.href = `api/notes/${encodeURIComponent(noteId)}/download`;
    link.download = "";
    document.body.append(link);
    link.click();
    link.remove();
}

function showToast(text: string) {
    const toast = document.createElement("div");
    toast.className = "collab-toast";
    toast.setAttribute("role", "status");
    toast.textContent = text;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 2000);
}

/**
 * Keeps the tree and the title row current without reloading the page. A change to the tree, to a
 * note's color or icon, or to the title of a note in the tree fetches the tree again, rendered by
 * the server as on page load; the branches the guest opened stay open.
 */
export function followTreeChanges(bootstrap: CollabBootstrap, events: EventTarget) {
    let running: Promise<void> | null = null;
    let again = false;

    const refresh = () => {
        if (running) {
            again = true;
            return;
        }

        running = refreshTree(bootstrap, events)
            .catch((e) => console.error(e)) // eslint-disable-line no-console
            .finally(() => {
                running = null;

                if (again) {
                    again = false;
                    refresh();
                }
            });
    };

    events.addEventListener("collab-refresh", refresh);
    events.addEventListener("collab-update", (event) => {
        const update = (event as CustomEvent<CollabUpdate>).detail;

        if (update.treeChanged || update.notes.some(changesTreeRow)) {
            refresh();
        }
    });
}

interface TreeMenu {
    html: string;
    childrenHtml: string;
    iconClass: string;
    color: string | null;
    hasHue: boolean;
}

async function refreshTree(bootstrap: CollabBootstrap, events: EventTarget) {
    const menu = document.getElementById("menu");
    const response = await fetch(`api/tree-menu?active=${encodeURIComponent(bootstrap.noteId)}`,
        { credentials: "same-origin" });

    if (!menu || !response.ok) {
        return;
    }

    const fresh = await response.json() as TreeMenu;
    applyTree(fresh.html);
    updateTitleRow(fresh);
    updateNoteList(fresh.childrenHtml);
    events.dispatchEvent(new CustomEvent("collab-appearance", {
        detail: { iconClass: fresh.iconClass }
    }));
}

/** Puts the server's tree in the sidebar; the branches the guest opened stay open. */
function applyTree(html: string) {
    const menu = document.getElementById("menu");

    if (!menu) {
        return;
    }

    const open = new Set([ ...menu.querySelectorAll<HTMLElement>("li.expanded > a[data-note-id]") ]
        .map((link) => link.dataset.noteId));

    menu.innerHTML = html;

    for (const link of menu.querySelectorAll<HTMLElement>("li > a[data-note-id]")) {
        if (open.has(link.dataset.noteId)) {
            link.parentElement?.classList.add("expanded");
        }
    }

    setupExpanders();
}

/** Puts the cards of the shown note's children under its body, as the server renders them. */
function updateNoteList(html: string) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    const fresh = template.content.querySelector(".collab-note-list");
    const shown = document.querySelector(".collab-note-list");

    if (shown && fresh) {
        shown.replaceWith(fresh);
    } else if (shown) {
        shown.remove();
    } else if (fresh) {
        document.getElementById("content")?.after(fresh);
    }
}

/** Puts the shown note's icon and color on its title row, as the server renders them. */
function updateTitleRow(
    { iconClass, color, hasHue }: Pick<TreeMenu, "iconClass" | "color" | "hasHue">
) {
    const row = document.querySelector<HTMLElement>(".collab-title-row");
    const icon = row?.querySelector<HTMLElement>(".collab-note-icon");

    if (!row || !icon) {
        return;
    }

    const shown = icon.dataset.iconClass ?? "";

    if (shown !== iconClass) {
        icon.classList.remove(...shown.split(" ").filter(Boolean));
        icon.classList.add(...iconClass.split(" ").filter(Boolean));
        icon.dataset.iconClass = iconClass;
    }

    if (color) {
        row.dataset.color = color;
        row.style.setProperty("--note-color", color);
    } else {
        delete row.dataset.color;
        row.style.removeProperty("--note-color");
    }

    row.toggleAttribute("data-color-hue", !!color && hasHue);
}

/** The guest pages at the root of a collaboration that are not notes. */
const NOT_NOTE_PAGES = new Set([ "login", "logout" ]);
const NOTE_ID_PATTERN = /^[A-Za-z0-9_]{1,64}$/;

/**
 * The page of the collaboration's note a link opens, or null for any other link: another site or
 * collaboration, the guest API, a heading on the page, a download or a new window. `base` is the
 * collaboration's root page.
 */
export function collabNoteTarget(link: HTMLAnchorElement, base: URL): URL | null {
    const href = link.getAttribute("href");

    if (!href || href.startsWith("#") || link.hasAttribute("download")
            || (link.target && link.target !== "_self")) {
        return null;
    }

    let url: URL;

    try {
        url = new URL(link.href);
    } catch {
        return null;
    }

    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
        return null;
    }

    const rest = url.pathname.slice(base.pathname.length);

    return rest === "" || (NOTE_ID_PATTERN.test(rest) && !NOT_NOTE_PAGES.has(rest)) ? url : null;
}

/**
 * Switches between the collaboration's notes in place. A link to another of its notes fetches that
 * note's page, as the server renders it, and swaps in what differs, so the editor with its toolbar
 * and the live connection stay as they are. The browser's back and forward do the same. Where the
 * page cannot show the note in place, it loads normally through `load`. Returns what removes the
 * listeners again.
 */
export function setupNavigation(
    bootstrap: CollabBootstrap, events: EventTarget,
    load: (href: string) => void = (href) => location.assign(href)
): () => void {
    const base = new URL(".", location.href);
    const listening = new AbortController();
    let queue = Promise.resolve();
    let refreshQueued = false;

    // One switch at a time, so quick clicks land on the last note clicked.
    const run = (task: () => Promise<void>, fallback: () => string) => {
        queue = queue.then(task).catch((e) => {
            console.error(e); // eslint-disable-line no-console
            load(fallback());
        });
    };
    const go = (url: URL, push: boolean) =>
        run(() => switchPage(bootstrap, events, url, push, load), () => url.href);

    bootstrap.navigate = (href) => go(new URL(href, location.href), true);
    // A queued refresh shows every change made before it starts.
    bootstrap.refresh = () => {
        if (refreshQueued) {
            return;
        }

        refreshQueued = true;
        run(() => {
            refreshQueued = false;
            return refreshPage(bootstrap, load);
        }, () => location.href);
    };

    document.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0
                || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const link = (event.target as Element | null)?.closest?.("a[href]");
        const url = link instanceof HTMLAnchorElement ? collabNoteTarget(link, base) : null;

        if (!url) {
            return;
        }

        event.preventDefault();

        if (url.pathname !== location.pathname) {
            go(url, true);
        }
    }, { signal: listening.signal });
    window.addEventListener("popstate", () => go(new URL(location.href), false),
        { signal: listening.signal });

    return () => listening.abort();
}

async function switchPage(
    bootstrap: CollabBootstrap, events: EventTarget, url: URL, push: boolean,
    load: (href: string) => void
) {
    const fetched = await fetchPage(bootstrap, url);

    if (!fetched) {
        load(url.href);
        return;
    }

    const { page, next } = fetched;
    // The editor stays only when it can take the next note; it saves the open one first.
    const editing = hasEditor(bootstrap);

    if (editing && !await bootstrap.switchNote?.(next)) {
        load(url.href);
        return;
    }

    swapPage(page, editing);
    Object.assign(bootstrap, next);

    if (push) {
        history.pushState(null, "", url.href);
    }

    document.body.classList.remove("menu-open", "toc-open");
    document.getElementById("right-pane")?.scrollTo?.(0, 0);
    events.dispatchEvent(new CustomEvent("collab-navigated", {
        detail: { navigation: push ? "navigate" : "back_forward" }
    }));
}

/**
 * Shows the server's latest version of the open note in place. Unlike a switch to another note, it
 * keeps the scroll position, the open panes and the browser's history as they are.
 */
async function refreshPage(bootstrap: CollabBootstrap, load: (href: string) => void) {
    const url = new URL(location.href);
    const fetched = await fetchPage(bootstrap, url);

    if (!fetched || fetched.next.noteId !== bootstrap.noteId) {
        load(url.href);
        return;
    }

    swapPage(fetched.page, hasEditor(bootstrap));
    Object.assign(bootstrap, fetched.next);
}

/**
 * The collaboration's page at `url` and its bootstrap, or null when the page cannot show it in
 * place: the request failed, or the page offers the guest a different tree or capabilities, which
 * only a page load sets up.
 */
async function fetchPage(bootstrap: CollabBootstrap, url: URL) {
    const response = await fetch(url.href, { credentials: "same-origin" });

    if (!response.ok) {
        return null;
    }

    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    const next = readPageBootstrap(page);
    const sameOffer = next?.collabId === bootstrap.collabId
        && next.includeSubtree === bootstrap.includeSubtree
        && next.capabilities.join() === bootstrap.capabilities.join();

    return next && sameOffer ? { page, next } : null;
}

function readPageBootstrap(page: Document): CollabBootstrap | null {
    try {
        return JSON.parse(page.getElementById("collab-bootstrap")?.textContent ?? "null") as
            CollabBootstrap | null;
    } catch {
        return null;
    }
}

/**
 * Puts what differs between the shown note's page and `page` in place. An editor keeps its
 * `#content`, which the editor itself has loaded the next note into.
 */
function swapPage(page: Document, editing: boolean) {
    document.title = page.title;
    document.body.dataset.noteId = page.body.dataset.noteId ?? "";

    for (const name of [ ...document.body.classList ].filter((name) => name.startsWith("type-"))) {
        document.body.classList.remove(name);
    }

    document.body.classList.add(
        ...[ ...page.body.classList ].filter((name) => name.startsWith("type-")));

    swapTitleRow(page);
    swapInfoLine(page);

    const returnTo = page.querySelector<HTMLInputElement>(".collab-unlock input[name=returnTo]");
    const shownReturnTo = document.querySelector<HTMLInputElement>(
        ".collab-unlock input[name=returnTo]");

    if (returnTo && shownReturnTo) {
        shownReturnTo.value = returnTo.value;
    }

    if (!editing) {
        replaceById(page, "content");
    }

    updateNoteList(page.querySelector(".collab-note-list")?.outerHTML ?? "");
    replaceById(page, "content-footer");
    swapContents(page);
    applyTree(page.getElementById("menu")?.innerHTML ?? "");

    if (!editing) {
        for (const setup of [ setupMermaid, setupMath, setupVideoFacades, setupFaviconContrast ]) {
            Promise.resolve().then(setup)
                .catch((e) => console.error(e)); // eslint-disable-line no-console
        }
    }

    setupToC();
    formatTimes(document);
}

function replaceById(page: Document, id: string) {
    const shown = document.getElementById(id);
    const fresh = page.getElementById(id);

    if (shown && fresh) {
        shown.replaceWith(document.importNode(fresh, true));
    }
}

/** The title, icon and color of the next note, put on the shown row so its listeners stay. */
function swapTitleRow(page: Document) {
    const row = page.querySelector<HTMLElement>(".collab-title-row");
    const icon = row?.querySelector<HTMLElement>(".collab-note-icon");
    const title = document.getElementById("title");
    const shownIcon = document.querySelector<HTMLElement>(".collab-title-row .collab-note-icon");

    if (!row || !icon) {
        return;
    }

    if (title) {
        title.textContent = page.getElementById("title")?.textContent ?? "";
    }

    if (shownIcon && icon.dataset.noteId) {
        shownIcon.dataset.noteId = icon.dataset.noteId;
    }

    updateTitleRow({
        iconClass: icon.dataset.iconClass ?? "",
        color: row.dataset.color ?? null,
        hasHue: row.hasAttribute("data-color-hue")
    });
}

/** The next note's type and dates; the editor's status stays at the end of the line. */
function swapInfoLine(page: Document) {
    const info = document.querySelector(".collab-note-info");
    const fresh = page.querySelector(".collab-note-info");

    if (!info || !fresh) {
        return;
    }

    const status = info.querySelector(".collab-status");
    info.replaceChildren(...[ ...fresh.childNodes ].map((node) => document.importNode(node, true)));

    if (status) {
        info.append(status);
    }
}

/** The contents pane after `#main`, and its header button, which stays so its listener does. */
function swapContents(page: Document) {
    const button = document.getElementById("toc-pane-toggle-button");
    const pane = document.getElementById("toc-pane");
    const fresh = page.getElementById("toc-pane");

    if (button) {
        button.hidden = page.getElementById("toc-pane-toggle-button")?.hidden ?? true;
    }

    if (pane && fresh) {
        pane.replaceWith(document.importNode(fresh, true));
    } else if (pane) {
        pane.remove();
    } else if (fresh) {
        document.getElementById("main")?.after(document.importNode(fresh, true));
    }
}

/** Shows the `<time>` elements under `root` in the browser's own date format. */
export function formatTimes(root: ParentNode) {
    for (const element of root.querySelectorAll<HTMLTimeElement>("time[datetime]")) {
        const date = new Date(element.dateTime);

        if (!isNaN(date.getTime())) {
            element.textContent = date.toLocaleDateString();
        }
    }
}

/** Whether the update renames a note the tree shows, or switches its type, which its row shows. */
function changesTreeRow(note: { noteId: string; title?: string; type?: string }) {
    const row = [ ...document.querySelectorAll<HTMLElement>("#menu a[data-note-id]") ]
        .find((link) => link.dataset.noteId === note.noteId);

    if (!row) {
        return false;
    }

    const shown = row.querySelector(":scope > span")?.textContent?.trim();
    const renamed = typeof note.title === "string" && shown !== note.title.trim();
    const retyped = typeof note.type === "string" && !row.classList.contains(`type-${note.type}`);

    return renamed || retyped;
}

/**
 * Gives every password box on a guest page its eye: pressing it shows the password in clear and
 * keeps the focus in the box, so the typing goes on.
 */
export function setupPasswordReveal() {
    for (const box of document.querySelectorAll<HTMLElement>(".collab-password")) {
        const input = box.querySelector("input");
        const toggle = box.querySelector("button");

        if (!input || !toggle) {
            continue;
        }

        // The focus change is mousedown's default action; the click still fires.
        toggle.addEventListener("mousedown", (event) => event.preventDefault());
        toggle.addEventListener("click", () => {
            const revealed = input.type === "password";
            input.type = revealed ? "text" : "password";
            box.classList.toggle("revealed", revealed);
            toggle.setAttribute("aria-pressed", String(revealed));
            const label = revealed ? toggle.dataset.hide : toggle.dataset.show;
            toggle.setAttribute("aria-label", label ?? "");
        });
    }
}

/**
 * Opens the guest socket at the app root with `?collab=<id>` once `ready` settles, and reconnects
 * when it drops, unless the collaboration ended or the host removed the guest.
 */
export function connectGuestSocket(
    bootstrap: CollabBootstrap, events: EventTarget, ready: Promise<unknown>
): (message: object) => void {
    const url = new URL("../../", location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.search = `?collab=${encodeURIComponent(bootstrap.collabId)}`;

    let socket: WebSocket | null = null;
    let attempt = 0;
    let fullNotice: HTMLElement | null = null;

    const connect = () => {
        socket = new WebSocket(url.href);
        socket.onopen = () => {
            attempt = 0;
            fullNotice?.remove();
            fullNotice = null;
            events.dispatchEvent(new CustomEvent("collab-open"));
        };
        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(String(event.data)) as { type?: string };

                if (message?.type) {
                    events.dispatchEvent(new CustomEvent(message.type, { detail: message }));
                }
            } catch (e) {
                console.error(e); // eslint-disable-line no-console
            }
        };
        socket.onclose = (event) => {
            socket = null;

            // The server closes a guest socket normally only when the host ended the collaboration.
            if (event.code === 1000) {
                events.dispatchEvent(new CustomEvent("collab-ended"));
                showNotice(bootstrap.strings.ended ?? "");
                return;
            }

            // The host removed the guest: the page stays, and nothing on it works any more.
            if (event.code === COLLAB_REMOVED_CLOSE_CODE) {
                events.dispatchEvent(new CustomEvent("collab-removed"));
                showNotice(bootstrap.strings.removed ?? "");

                for (const id of [ "left-pane", "main" ]) {
                    document.getElementById(id)?.toggleAttribute("inert", true);
                }

                return;
            }

            // The guest limit is reached: say so once and keep trying for a seat.
            if (event.code === COLLAB_FULL_CLOSE_CODE) {
                fullNotice ??= showNotice(bootstrap.strings.full ?? "");
                setTimeout(connect, FULL_RETRY_DELAY);
                return;
            }

            attempt++;
            setTimeout(connect, Math.min(60000, 1000 * 2 ** Math.min(attempt, 6)));
        };
    };

    void ready.then(connect);

    return (message) => {
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    };
}

function showNotice(text: string): HTMLElement {
    const notice = document.createElement("div");
    notice.className = "collab-presence collab-notice";
    notice.textContent = text;
    insertBelowHeader(notice);

    return notice;
}
