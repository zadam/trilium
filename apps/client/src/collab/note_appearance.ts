import type { IconRegistry } from "@triliumnext/commons";
import { h, render } from "preact";

import ColorPicker from "../widgets/react/ColorPicker.jsx";

/** What the controls need from `window.collab`. */
export interface NoteAppearanceBootstrap {
    noteId: string;
    strings: Record<string, string>;
    /** The page's live events, through which a change asks the page to refresh. */
    events?: EventTarget;
}

interface Appearance {
    color?: string | null;
    iconClass?: string | null;
}

type ApplyAppearance = (noteId: string, appearance: Appearance) => Promise<void>;

/**
 * The color and icon controls of a guest who can edit, as the app offers them: a right-click menu
 * on the tree's rows, with the app's color picker and an icon chooser, and the icon beside the
 * title, which opens the chooser. A change writes the note's labels through the guest API and asks
 * the page to refresh its tree and title row.
 */
export function setupNoteAppearance(bootstrap: NoteAppearanceBootstrap, csrfToken: string) {
    let panel: HTMLElement | null = null;
    let opener: Element | null = null;

    const close = () => {
        if (panel) {
            render(null, panel);
            panel.remove();
        }

        panel = null;
        opener = null;
    };
    const open = (x: number, y: number, by: Element | null) => {
        close();
        panel = createPanel(x, y);
        opener = by;

        return panel;
    };
    const apply: ApplyAppearance = async (noteId, appearance) => {
        const response = await fetch(`api/notes/${encodeURIComponent(noteId)}/appearance`, {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
            body: JSON.stringify(appearance)
        });

        if (response.ok) {
            bootstrap.events?.dispatchEvent(new CustomEvent("collab-refresh"));
        }
    };

    document.getElementById("menu")?.addEventListener("contextmenu", (event) => {
        const row = (event.target as Element).closest<HTMLAnchorElement>("a[data-note-id]");

        if (!row) {
            return;
        }

        event.preventDefault();
        showMenu(open(event.clientX, event.clientY, row), row, bootstrap.strings, apply, close);
    });

    // The note options menu asks for the same pickers for the shown note.
    bootstrap.events?.addEventListener("collab-change-icon", (event) => {
        const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
        void showIconChooser(open(x, y, null), bootstrap.strings, (iconClass) => {
            close();
            void apply(bootstrap.noteId, { iconClass });
        });
    });
    bootstrap.events?.addEventListener("collab-change-color", (event) => {
        const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
        const color = document.querySelector<HTMLElement>(".collab-title-row")?.dataset.color;
        const panel = open(x, y, null);
        showColorPicker(panel, bootstrap.noteId, color || null, bootstrap.strings, apply, close);
        keepOnScreen(panel);
    });

    const titleIcon = document.querySelector<HTMLButtonElement>("button.collab-note-icon");
    titleIcon?.addEventListener("click", () => {
        // A second press closes the chooser the first one opened.
        if (opener === titleIcon) {
            close();
            return;
        }

        const rect = titleIcon.getBoundingClientRect();
        const noteId = titleIcon.dataset.noteId ?? "";
        void showIconChooser(open(rect.left, rect.bottom + 4, titleIcon), bootstrap.strings,
            (iconClass) => {
                close();
                void apply(noteId, { iconClass });
            });
    });

    document.addEventListener("pointerdown", (event) => {
        const target = event.target as Node;

        if (panel && !panel.contains(target) && !opener?.contains(target)) {
            close();
        }
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            close();
        }
    });
}

function createPanel(x: number, y: number): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "collab-context-menu";
    // Where the pointer or the icon is; the stylesheet cannot know.
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    document.body.append(panel);

    return panel;
}

/** The two entries of a row's menu, each turning the menu into its picker. */
function showMenu(
    panel: HTMLElement, row: HTMLAnchorElement, strings: Record<string, string>,
    apply: ApplyAppearance, close: () => void
) {
    const noteId = row.dataset.noteId ?? "";
    panel.setAttribute("role", "menu");

    const colorItem = menuItem(strings.change_color ?? "", () =>
        showColorPicker(panel, noteId, row.dataset.color || null, strings, apply, close));
    const iconItem = menuItem(strings.change_icon ?? "", () => {
        panel.replaceChildren();
        void showIconChooser(panel, strings, (iconClass) => {
            close();
            void apply(noteId, { iconClass });
        });
    });

    panel.append(colorItem, iconItem);
    keepOnScreen(panel);
    colorItem.focus();
}

/** The app's color picker in the panel, writing the note's color as each color is picked. */
function showColorPicker(
    panel: HTMLElement, noteId: string, color: string | null, strings: Record<string, string>,
    apply: ApplyAppearance, close: () => void
) {
    panel.replaceChildren();
    panel.classList.add("collab-context-panel");
    render(h(ColorPicker, {
        currentValue: color,
        onChange: (value) => void apply(noteId, { color: value }),
        // Worded by the page's catalogue, so the client's own never has to load here.
        tooltips: {
            clear: strings.clear_color,
            set: strings.set_color,
            setCustom: strings.custom_color
        }
    }), panel);
    // A swatch closes the menu, as a pick from the app's menu does. The custom cell keeps its
    // clicks to itself, so the menu stays open while the browser's color chooser is, and each
    // color chosen there applies as it is picked.
    panel.addEventListener("click", (event) => {
        if ((event.target as Element).closest(".color-cell")) {
            close();
        }
    });
}

function menuItem(text: string, onPick: () => void): HTMLButtonElement {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "collab-context-item";
    item.setAttribute("role", "menuitem");
    item.textContent = text;
    item.addEventListener("click", onPick);

    return item;
}

function keepOnScreen(panel: HTMLElement) {
    const rect = panel.getBoundingClientRect();
    const overflowX = rect.right - window.innerWidth + 8;
    const overflowY = rect.bottom - window.innerHeight + 8;

    if (overflowX > 0) {
        panel.style.left = `${Math.max(0, rect.left - overflowX)}px`;
    }

    if (overflowY > 0) {
        panel.style.top = `${Math.max(0, rect.top - overflowY)}px`;
    }
}

let iconRegistry: Promise<IconRegistry> | null = null;

/** A search box over the built-in icon packs, each icon a button wearing its own class. */
async function showIconChooser(
    panel: HTMLElement, strings: Record<string, string>, onPick: (iconClass: string | null) => void
) {
    panel.classList.add("collab-context-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", strings.change_icon ?? "");

    const search = document.createElement("input");
    search.type = "search";
    search.className = "collab-icon-search";
    search.placeholder = strings.search_icons ?? "";
    const reset = menuItem(strings.reset_icon ?? "", () => onPick(null));
    const grid = document.createElement("div");
    grid.className = "collab-icon-grid";
    panel.append(search, reset, grid);
    search.focus();

    iconRegistry ??= fetch("api/icons", { credentials: "same-origin" })
        .then((response) => response.json() as Promise<IconRegistry>);
    const icons = (await iconRegistry).sources.flatMap((source) => source.icons);

    const show = () => {
        const term = search.value.trim().toLowerCase();
        const matching = term
            ? icons.filter((icon) =>
                icon.id.includes(term) || icon.terms.some((t) => t.includes(term)))
            : icons;

        grid.replaceChildren(...matching.slice(0, 200).map((icon) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "collab-icon-choice";
            button.title = icon.terms[0] ?? icon.id;
            const glyph = document.createElement("span");
            glyph.className = icon.id;
            button.append(glyph);
            button.addEventListener("click", () => onPick(icon.id));

            return button;
        }));
    };

    search.addEventListener("input", show);
    show();
    keepOnScreen(panel);
}
