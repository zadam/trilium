/** How long the pointer rests on a row before its submenu opens: the app's opening delay. */
const SUBMENU_DELAY_MS = 150;

/** The room a menu keeps from the edges of the window. */
const VIEWPORT_MARGIN = 8;

/** A menu's padding and border, which a submenu rises by so its first row lines up with its row. */
const MENU_INSET = 9;

export type MenuRow =
    | {
        kind: "item";
        label: string;
        icon?: string;
        checked?: boolean;
        /** Shown, with `title` saying why, but not to be picked. */
        disabled?: boolean;
        title?: string;
        run: () => void;
    }
    | { kind: "submenu"; label: string; icon?: string; search?: string; rows: () => MenuRow[] }
    | { kind: "divider" };

type SubmenuRow = Extract<MenuRow, { kind: "submenu" }>;

/**
 * Builds a menu drawn and driven as the app's: rows with an icon column, where a chosen row shows
 * a check; rows that open a submenu beside them when the pointer rests on them, on a click, or on
 * the right arrow key; and dividers. Picking a row calls `close`, then runs the row.
 */
export function buildMenu(rows: MenuRow[], close: () => void, label?: string): HTMLElement {
    const menu = createMenuElement(label);
    let open: { row: HTMLElement; element: HTMLElement } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const closeSubmenu = () => {
        clearTimeout(timer);

        if (open) {
            open.row.classList.remove("collab-menu-expanded");
            open.row.setAttribute("aria-expanded", "false");
            open.element.remove();
            open = null;
        }
    };

    const openSubmenu = (row: HTMLElement, spec: SubmenuRow) => {
        clearTimeout(timer);

        if (open?.row === row) {
            return open.element;
        }

        closeSubmenu();
        const element = createMenuElement(spec.label);
        element.classList.add("collab-submenu");
        fill(element, spec.rows(), spec.search);
        element.addEventListener("pointerenter", () => clearTimeout(timer));
        element.addEventListener("keydown", (event) => {
            const inField = event.target instanceof HTMLInputElement;

            if (event.key === "Escape" || (event.key === "ArrowLeft" && !inField)) {
                // The submenu's own; the page's Escape would close the whole menu.
                event.preventDefault();
                event.stopPropagation();
                closeSubmenu();
                row.focus();
            }
        });
        menu.append(element);
        placeSubmenu(element, row);
        row.classList.add("collab-menu-expanded");
        row.setAttribute("aria-expanded", "true");
        centerChosenRow(element);
        open = { row, element };

        return element;
    };

    const fill = (target: HTMLElement, specs: MenuRow[], search?: string) => {
        let list = target;

        if (search) {
            // Only the rows scroll: the menu's frame, which carries the blur, never does.
            list = document.createElement("div");
            list.className = "collab-menu-scroll";
            target.append(buildSearch(search, list), list);
        }

        for (const spec of specs) {
            if (spec.kind === "divider") {
                const divider = document.createElement("div");
                divider.className = "collab-menu-divider";
                divider.setAttribute("role", "separator");
                list.append(divider);
                continue;
            }

            const row = renderRow(spec);
            list.append(row);

            if (spec.kind === "item") {
                row.addEventListener("click", () => {
                    if (!spec.disabled) {
                        close();
                        spec.run();
                    }
                });
                row.addEventListener("pointerenter", () => {
                    if (open && target === menu) {
                        clearTimeout(timer);
                        timer = setTimeout(closeSubmenu, SUBMENU_DELAY_MS);
                    }
                });
                continue;
            }

            row.addEventListener("pointerenter", () => {
                clearTimeout(timer);

                // One submenu replaces another at once, as in the app.
                if (open) {
                    openSubmenu(row, spec);
                } else {
                    timer = setTimeout(() => {
                        if (menu.isConnected) {
                            openSubmenu(row, spec);
                        }
                    }, SUBMENU_DELAY_MS);
                }
            });
            row.addEventListener("click", () => {
                if (open?.row === row) {
                    closeSubmenu();
                } else {
                    openSubmenu(row, spec);
                }
            });
            row.addEventListener("keydown", (event) => {
                if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    focusFirst(openSubmenu(row, spec));
                }
            });
        }
    };

    fill(menu, rows);

    return menu;
}

/**
 * Places a menu under `anchor` with its right edge at the anchor's, as the app's note menu opens,
 * and turns its submenus to the side they open on. As in the app, they open on the right unless
 * only the left has room for one as wide as the menu, and their rows' arrows point that way.
 */
export function placeMenu(menu: HTMLElement, anchor: DOMRect) {
    menu.style.top = `${anchor.bottom + 4}px`;
    menu.style.left = `${Math.max(VIEWPORT_MARGIN, anchor.right - menu.offsetWidth)}px`;

    const frame = menu.getBoundingClientRect();
    const roomOnRight = document.documentElement.clientWidth - frame.right;
    const dropStart = roomOnRight < frame.width && frame.left > roomOnRight;
    menu.classList.toggle("collab-menu-drop-start", dropStart);

    for (const arrow of menu.querySelectorAll(":scope > .collab-menu-item .collab-menu-arrow")) {
        arrow.classList.toggle("bx-chevron-left", dropStart);
        arrow.classList.toggle("bx-chevron-right", !dropStart);
    }
}

function createMenuElement(label?: string): HTMLElement {
    const element = document.createElement("div");
    element.className = "collab-menu";
    element.setAttribute("role", "menu");

    if (label) {
        element.setAttribute("aria-label", label);
    }

    element.addEventListener("keydown", (event) => moveFocus(element, event));

    return element;
}

function renderRow(spec: Exclude<MenuRow, { kind: "divider" }>): HTMLButtonElement {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "collab-menu-item";
    const checked = spec.kind === "item" ? spec.checked : undefined;
    row.setAttribute("role", checked === undefined ? "menuitem" : "menuitemradio");

    if (checked !== undefined) {
        row.setAttribute("aria-checked", String(checked));
    }

    if (spec.kind === "item" && spec.disabled) {
        row.setAttribute("aria-disabled", "true");
    }

    if (spec.kind === "item" && spec.title) {
        row.title = spec.title;
    }

    // As in the app, a chosen row shows a check where its icon goes, and a row without an icon
    // keeps the column, so the labels line up.
    const icon = document.createElement("span");
    icon.className = `collab-menu-icon ${checked ? "bx bx-check" : spec.icon ?? ""}`.trim();
    const text = document.createElement("span");
    text.className = "collab-menu-label";
    text.textContent = spec.label;
    row.append(icon, text);

    if (spec.kind === "submenu") {
        row.setAttribute("aria-haspopup", "menu");
        row.setAttribute("aria-expanded", "false");
        const arrow = document.createElement("span");
        arrow.className = "collab-menu-arrow bx bx-chevron-right";
        row.append(arrow);
    }

    return row;
}

/** A field over a list of rows that hides each row lacking what is typed; Enter picks the first. */
function buildSearch(label: string, list: HTMLElement): HTMLInputElement {
    const search = document.createElement("input");
    search.type = "search";
    search.className = "collab-menu-search";
    search.placeholder = label;
    search.setAttribute("aria-label", label);
    const rows = () => [ ...list.querySelectorAll<HTMLElement>(".collab-menu-item") ];

    search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();

        for (const row of rows()) {
            row.hidden = !(row.textContent ?? "").toLowerCase().includes(query);
        }
    });
    search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            rows().find((row) => !row.hidden && !isDisabled(row))?.click();
        }
    });

    return search;
}

/** The arrow keys, Home and End move among the rows of the menu the focus is in. */
function moveFocus(element: HTMLElement, event: KeyboardEvent) {
    const target = event.target instanceof Element ? event.target : null;
    const inField = target instanceof HTMLInputElement;
    const keys = inField ? [ "ArrowDown", "ArrowUp" ] : [ "ArrowDown", "ArrowUp", "Home", "End" ];

    if (!keys.includes(event.key) || target?.closest(".collab-menu") !== element) {
        return;
    }

    // As in the app, the keys pass over a disabled row.
    const rows = [ ...element.querySelectorAll<HTMLElement>(".collab-menu-item") ]
        .filter((row) => !row.hidden && !isDisabled(row)
            && row.closest(".collab-menu") === element);

    if (rows.length === 0) {
        return;
    }

    event.preventDefault();
    const index = rows.indexOf(target as HTMLElement);
    let next: number;

    if (event.key === "Home") {
        next = 0;
    } else if (event.key === "End") {
        next = rows.length - 1;
    } else if (event.key === "ArrowDown") {
        next = index < 0 ? 0 : (index + 1) % rows.length;
    } else {
        next = index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length;
    }

    rows[next].focus();
}

/** Scrolls a long list of rows so the chosen one stands in its middle, leaving the page still. */
function centerChosenRow(element: HTMLElement) {
    const chosen = element.querySelector<HTMLElement>("[aria-checked=true]");
    const scroller = chosen?.closest<HTMLElement>(".collab-menu-scroll");

    if (chosen && scroller) {
        scroller.scrollTop = chosen.offsetTop - scroller.offsetTop
            - (scroller.clientHeight - chosen.offsetHeight) / 2;
    }
}

function focusFirst(element: HTMLElement) {
    element.querySelector<HTMLElement>(
        ".collab-menu-search, .collab-menu-item:not([aria-disabled=true])")?.focus();
}

function isDisabled(row: HTMLElement) {
    return row.getAttribute("aria-disabled") === "true";
}

/**
 * Beside the menu the row is in, its first row level with the row: on the side `placeMenu` turned
 * the menu's submenus to, and otherwise on the right where it fits.
 */
function placeSubmenu(element: HTMLElement, row: HTMLElement) {
    const menu = row.closest(".collab-menu") ?? row;
    const parent = menu.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const onRight = !menu.classList.contains("collab-menu-drop-start")
        && parent.right + width <= window.innerWidth - VIEWPORT_MARGIN;
    const left = onRight ? parent.right : Math.max(VIEWPORT_MARGIN, parent.left - width);
    const top = Math.min(row.getBoundingClientRect().top - MENU_INSET,
        window.innerHeight - height - VIEWPORT_MARGIN);

    element.style.left = `${left}px`;
    element.style.top = `${Math.max(VIEWPORT_MARGIN, top)}px`;
}
