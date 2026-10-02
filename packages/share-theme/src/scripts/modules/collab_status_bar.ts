import { buildMenu, type MenuRow, placeMenu } from "./menu.js";

/** How a code note indents: its width in columns, and whether a level is a tab. */
export interface Indentation {
    width: number;
    useTabs: boolean;
}

/** The part of `window.collab` the status bar reads. */
export interface StatusBarBootstrap {
    noteId: string;
    type?: string;
    editable?: boolean;
    capabilities: string[];
    csrfToken: string | null;
    /** A code note's indentation; null for other notes. */
    indentation?: Indentation | null;
    mime?: string;
    /** The note's type as the page names it, and the app's icon for it. */
    typeLabel?: string;
    typeIcon?: string;
    utcDateCreated?: string;
    utcDateModified?: string;
    strings: Record<string, string>;
}

/** The widths the app's status bar offers, which the bootstrap has a label for each of. */
const TAB_WIDTHS = [ 1, 2, 3, 4, 6, 8 ];

/**
 * The bar under the note, as the app's status bar: the path from the collaboration's shared note
 * down to the open one, read from the tree, for a code note its indentation, and at its end the
 * note's info. A guest who edits
 * the note changes the indentation from a menu, as in the app; the page's editor applies it
 * through the `collab-indentation` and `collab-reindent` events.
 */
export function setupStatusBar(bootstrap: StatusBarBootstrap, events: EventTarget) {
    const bar = document.getElementById("collab-status-bar");
    const breadcrumb = bar?.querySelector<HTMLElement>(".collab-breadcrumb");
    const end = bar?.querySelector<HTMLElement>(".collab-status-bar-end");

    if (!bar || !breadcrumb || !end) {
        return;
    }

    breadcrumb.setAttribute("aria-label", bootstrap.strings.note_path ?? "");
    let menu: HTMLElement | null = null;
    const closeMenu = () => {
        menu?.remove();
        menu = null;

        for (const button of end.querySelectorAll("button[aria-expanded]")) {
            button.setAttribute("aria-expanded", "false");
        }
    };

    const render = () => {
        closeMenu();
        renderBreadcrumb(breadcrumb, bootstrap.noteId);
        const info = renderInfoButton(bootstrap, (button) => {
            if (menu) {
                closeMenu();
                return;
            }

            menu = buildInfoPanel(bootstrap);
            document.body.append(menu);
            placeMenu(menu, button.getBoundingClientRect());
            button.setAttribute("aria-expanded", "true");
        });
        end.replaceChildren(...renderIndentation(bootstrap, (button) => {
            if (menu) {
                closeMenu();
                return;
            }

            menu = buildMenu(indentationRows(bootstrap, (change, reindent) => {
                const from = bootstrap.indentation;

                if (!from) {
                    return;
                }

                const to = { ...from, ...change };

                if (reindent) {
                    events.dispatchEvent(new CustomEvent("collab-reindent", {
                        detail: { from, to }
                    }));
                }

                bootstrap.indentation = to;
                events.dispatchEvent(new CustomEvent("collab-indentation", { detail: to }));
                render();
                void saveIndentation(bootstrap, change);
            }), closeMenu, bootstrap.strings.tab_width_title);
            document.body.append(menu);
            placeMenu(menu, button.getBoundingClientRect());
            button.setAttribute("aria-expanded", "true");
            menu.querySelector<HTMLButtonElement>(".collab-menu-item")?.focus();
        }), info);
    };

    render();
    events.addEventListener("collab-navigated", render);
    // The tree, which the path is read from, after a refresh.
    events.addEventListener("collab-appearance",
        () => renderBreadcrumb(breadcrumb, bootstrap.noteId));
    document.addEventListener("pointerdown", (event) => {
        const target = event.target as Node;

        if (menu && !menu.contains(target) && !end.contains(target)) {
            closeMenu();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
        }
    });
}

/** The icon button that opens the note's info, as the app's status bar ends with. */
function renderInfoButton(
    bootstrap: StatusBarBootstrap, open: (button: HTMLButtonElement) => void
): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "collab-status-bar-item collab-note-info-button";
    const icon = document.createElement("span");
    icon.className = "bx bx-info-circle";
    icon.setAttribute("aria-hidden", "true");
    button.append(icon);
    button.title = bootstrap.strings.note_info ?? "";
    button.setAttribute("aria-label", bootstrap.strings.note_info ?? "");
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => open(button));

    return button;
}

/**
 * The app's note info: when the note was created and changed, its type, MIME type and id, and its
 * size, which the guest asks for, as the app has it calculated on request.
 */
function buildInfoPanel(bootstrap: StatusBarBootstrap): HTMLElement {
    const strings = bootstrap.strings;
    const panel = document.createElement("section");
    panel.className = "collab-menu collab-note-info-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", strings.note_info ?? "");
    const list = document.createElement("dl");
    list.className = "collab-info-list";

    const row = (label: string | undefined, value: Node | string, title?: string) => {
        const term = document.createElement("dt");
        term.textContent = `${label ?? ""}:`;

        if (title) {
            term.title = title;
        }

        const detail = document.createElement("dd");
        detail.append(value);
        list.append(term, detail);

        return detail;
    };

    row(strings.info_created, formatDateTime(bootstrap.utcDateCreated));
    row(strings.info_modified, formatDateTime(bootstrap.utcDateModified));
    const type = document.createDocumentFragment();
    const icon = document.createElement("span");
    icon.className = bootstrap.typeIcon ?? "bx bx-note";
    icon.setAttribute("aria-hidden", "true");
    type.append(icon, ` ${bootstrap.typeLabel ?? bootstrap.type ?? ""}`);
    row(strings.info_type, type);

    if (bootstrap.mime) {
        row(strings.info_mime, bootstrap.mime);
    }

    const id = document.createElement("code");
    id.textContent = bootstrap.noteId;
    row(strings.info_note_id, id);

    const calculate = document.createElement("button");
    calculate.type = "button";
    calculate.className = "collab-info-calculate";
    calculate.textContent = strings.info_calculate ?? "";
    const size = row(strings.info_note_size, calculate, strings.info_note_size_hint);
    calculate.addEventListener("click", () => {
        size.textContent = "…";
        void fetchNoteSize(bootstrap.noteId).then((bytes) => {
            size.textContent = bytes === null ? "" : formatSize(bytes);
        });
    });

    panel.append(list);

    return panel;
}

async function fetchNoteSize(noteId: string): Promise<number | null> {
    try {
        const response = await fetch(`api/notes/${encodeURIComponent(noteId)}/size`,
            { credentials: "same-origin" });

        return response.ok ? (await response.json() as { noteSize: number }).noteSize : null;
    } catch {
        return null;
    }
}

/** A date and time as the app's note info shows them, in the browser's language. */
function formatDateTime(isoDate: string | undefined) {
    const date = new Date(isoDate ?? "");

    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });
}

const SIZE_UNITS = [ "B", "KiB", "MiB", "GiB", "TiB" ];

/** A byte count in the largest unit it fits in, as the app's `formatSize` writes it. */
function formatSize(size: number) {
    if (size <= 0) {
        return "0 B";
    }

    const unit = Math.min(Math.floor(Math.log(size) / Math.log(1024)), SIZE_UNITS.length - 1);

    return `${Math.round(size / Math.pow(1024, unit) * 100) / 100} ${SIZE_UNITS[unit]}`;
}

/** The tree's rows from the shared note down to the open note, each a link to its note. */
function renderBreadcrumb(breadcrumb: HTMLElement, noteId: string) {
    const rows: HTMLAnchorElement[] = [];
    let row = document.querySelector<HTMLAnchorElement>(
        `#menu a[data-note-id="${CSS.escape(noteId)}"]`);

    while (row) {
        rows.unshift(row);
        row = row.closest("li")?.parentElement?.closest("li")
            ?.querySelector<HTMLAnchorElement>(":scope > a[data-note-id]") ?? null;
    }

    breadcrumb.replaceChildren(...rows.flatMap((source, index) => {
        const link = document.createElement("a");
        link.className = "collab-breadcrumb-item";
        link.href = source.getAttribute("href") ?? "./";
        link.textContent = source.textContent?.trim() ?? "";

        if (index === 0) {
            const home = document.createElement("span");
            home.className = "bx bx-home-alt";
            home.setAttribute("aria-hidden", "true");
            link.prepend(home);
        }

        if (index === rows.length - 1) {
            link.setAttribute("aria-current", "page");
        }

        const separator = document.createElement("span");
        separator.className = "collab-breadcrumb-separator bx bx-chevron-right";
        separator.setAttribute("aria-hidden", "true");

        return index === 0 ? [ link ] : [ separator, link ];
    }));
}

/** The indentation of a code note: a menu button for a guest who edits it, else plain text. */
function renderIndentation(
    bootstrap: StatusBarBootstrap, open: (button: HTMLButtonElement) => void
): HTMLElement[] {
    const indentation = bootstrap.indentation;

    if (bootstrap.type !== "code" || !indentation) {
        return [];
    }

    const strings = bootstrap.strings;
    const text = (indentation.useTabs ? strings.tab_width_tabs : strings.tab_width_spaces_short)
        ?.replace("{{width}}", String(indentation.width)) ?? "";
    const canEdit = bootstrap.editable !== false && !!bootstrap.csrfToken
        && bootstrap.capabilities.includes("edit");
    const element = document.createElement(canEdit ? "button" : "span");
    element.className = "collab-status-bar-item collab-indentation";
    const icon = document.createElement("span");
    icon.className = "bx bx-right-indent";
    icon.setAttribute("aria-hidden", "true");
    element.append(icon, text);

    if (element instanceof HTMLButtonElement) {
        element.type = "button";
        element.title = strings.tab_width_title ?? "";
        element.setAttribute("aria-haspopup", "menu");
        element.setAttribute("aria-expanded", "false");
        element.addEventListener("click", () => open(element));
    }

    return [ element ];
}

/** The app's indentation menu: the indent style, the display width, and re-indenting. */
function indentationRows(
    bootstrap: StatusBarBootstrap,
    choose: (change: Partial<Indentation>, reindent: boolean) => void
): MenuRow[] {
    const strings = bootstrap.strings;
    const { width, useTabs } = bootstrap.indentation ?? { width: 4, useTabs: false };
    const label = (size: number) => strings[`tab_width_${size}`] ?? String(size);

    return [
        { kind: "header", label: strings.tab_width_style_header ?? "" },
        {
            kind: "item", label: strings.tab_width_style_spaces ?? "", checked: !useTabs,
            run: () => choose({ useTabs: false }, false)
        },
        {
            kind: "item", label: strings.tab_width_style_tabs ?? "", checked: useTabs,
            run: () => choose({ useTabs: true }, false)
        },
        { kind: "header", label: strings.tab_width_display_header ?? "" },
        ...TAB_WIDTHS.map((size): MenuRow => ({
            kind: "item", label: label(size), checked: width === size,
            run: () => choose({ width: size }, false)
        })),
        { kind: "header", label: strings.tab_width_reindent_header ?? "" },
        ...TAB_WIDTHS.map((size): MenuRow => ({
            kind: "item", label: label(size), disabled: !useTabs && width === size,
            run: () => choose({ width: size, useTabs: false }, true)
        })),
        {
            kind: "item", label: strings.tab_width_style_tabs ?? "", disabled: useTabs,
            run: () => choose({ useTabs: true }, true)
        }
    ];
}

/** Stores the change as the note's labels; the answer is the indentation the note now has. */
async function saveIndentation(bootstrap: StatusBarBootstrap, change: Partial<Indentation>) {
    try {
        const response = await fetch(
            `api/notes/${encodeURIComponent(bootstrap.noteId)}/indentation`, {
                method: "PUT",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-token": bootstrap.csrfToken ?? ""
                },
                body: JSON.stringify(change)
            });

        if (response.ok) {
            bootstrap.indentation = await response.json() as Indentation;
        }
    } catch (e) {
        console.error(e); // eslint-disable-line no-console
    }
}
