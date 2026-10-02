import {
    COLLAB_PERSON_COLOR_NAMES, COLLAB_PERSON_COLORS, type CollabPerson, MAX_COLLAB_NAME_LENGTH,
    normalizeCollabColor
} from "@triliumnext/commons/src/lib/collab.js";

import { buildMenu, type MenuRow, placeMenu } from "./menu.js";

/** The part of `window.collab` the people panel reads. */
export interface PeopleBootstrap {
    collabId: string;
    noteId: string;
    title: string;
    includeSubtree: boolean;
    csrfToken: string | null;
    /** The page's own person in the list, or null until the page joined. */
    selfId?: string | null;
    strings: Record<string, string>;
}

/**
 * Gives a page without a guest of its own one, which its socket needs before it connects: a
 * viewer's page renders without a session. A page that cannot join still reads as it did.
 */
export async function ensureJoined(bootstrap: PeopleBootstrap): Promise<void> {
    if (bootstrap.selfId) {
        return;
    }

    try {
        const response = await fetch("api/join", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: "{}"
        });

        if (response.ok) {
            const joined = await response.json() as { selfId: string | null; csrfToken: string };
            bootstrap.selfId = joined.selfId;
            bootstrap.csrfToken ??= joined.csrfToken;
        }
    } catch (e) {
        console.error(e); // eslint-disable-line no-console
    }
}

/**
 * Lists the people on the collaboration's pages in a dropdown beside the note options, as the
 * host's app does in the note's title row: each with their color and initial, the note they are on
 * when there are several, and a pencil while they edit. Every row offers a color; the page's own
 * row says so and offers a rename. Names only ever reach the page as text.
 */
export function setupPeople(bootstrap: PeopleBootstrap, events: EventTarget) {
    const options = document.querySelector(".collab-note-options");

    if (!options) {
        return;
    }

    const { strings } = bootstrap;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "collab-people-toggle";
    toggle.hidden = true;
    toggle.title = strings.people ?? "";
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    const toggleIcon = document.createElement("span");
    toggleIcon.className = "bx bx-user";
    const toggleCount = document.createElement("span");
    toggleCount.className = "collab-people-toggle-count";
    const toggleArrow = document.createElement("span");
    toggleArrow.className = "bx bx-chevron-down";
    toggle.append(toggleIcon, toggleCount, toggleArrow);
    options.before(toggle);

    // Drawn as the app's menus are, but a panel: its rows hold buttons and a field of their own.
    const panel = document.createElement("section");
    panel.className = "collab-menu collab-people";
    panel.setAttribute("role", "dialog");
    const heading = document.createElement("h2");
    heading.className = "collab-people-heading";
    const label = document.createElement("span");
    label.textContent = strings.people ?? "";
    const count = document.createElement("span");
    count.className = "collab-people-count";
    heading.append(label, count);
    const list = document.createElement("ul");
    list.className = "collab-people-list";
    panel.setAttribute("aria-label", strings.people ?? "");
    panel.append(heading, list);

    const setOpen = (open: boolean) => {
        toggle.setAttribute("aria-expanded", String(open));

        if (!open) {
            panel.remove();
            return;
        }

        document.body.append(panel);
        placeMenu(panel, toggle.getBoundingClientRect());
        panel.querySelector<HTMLButtonElement>("button")?.focus();
    };

    toggle.addEventListener("click", () => setOpen(!panel.isConnected));
    document.addEventListener("pointerdown", (event) => {
        const target = event.target as Node;

        // The color menu opens from the panel and is a part of it.
        if (panel.isConnected && !panel.contains(target) && !toggle.contains(target)
                && !(target instanceof Element && target.closest(".collab-menu"))) {
            setOpen(false);
        }
    });

    let people: CollabPerson[] = [];
    let renaming = false;
    /** Note titles the live updates brought, newer than the tree's until it refreshes. */
    const titles = new Map<string, string>();

    const render = () => {
        if (renaming) {
            return;
        }

        count.textContent = String(people.length);
        toggleCount.textContent = String(people.length);
        list.replaceChildren(...people.map((person) => renderPerson(person)));
        toggle.hidden = people.length === 0;

        if (people.length === 0) {
            setOpen(false);
        }
    };

    const renderPerson = (person: CollabPerson) => {
        const isSelf = person.id === bootstrap.selfId;
        const row = document.createElement("li");
        row.className = isSelf ? "collab-person collab-person-self" : "collab-person";
        row.dataset.personId = person.id;
        row.style.setProperty("--collab-color", person.color);

        const initial = document.createElement("span");
        initial.className = "collab-person-initial";
        initial.setAttribute("aria-hidden", "true");
        initial.textContent = [ ...person.name ][0]?.toUpperCase() ?? "";

        const text = document.createElement("span");
        text.className = "collab-person-text";
        const name = document.createElement("span");
        name.className = "collab-person-name";
        name.textContent = person.name;
        text.append(name);

        for (const [ shown, className, tag ] of [
            [ person.isHost, "collab-person-host", strings.host_tag ],
            [ isSelf, "collab-person-you", strings.you ]
        ] as const) {
            if (shown) {
                const element = document.createElement("span");
                element.className = className;
                element.textContent = tag ?? "";
                text.append(element);
            }
        }

        const noteTitle = bootstrap.includeSubtree && person.noteId
            ? titleOf(person.noteId)
            : "";

        if (noteTitle) {
            const note = document.createElement("span");
            note.className = "collab-person-note";
            note.textContent = noteTitle;
            text.append(note);
        }

        row.append(initial, text);

        // A guest's own color is theirs to set for everyone; another person's, for this page.
        const color = document.createElement("button");
        color.type = "button";
        color.className = "collab-person-color bx bx-palette";
        color.title = (isSelf ? strings.change_own_color : strings.change_person_color) ?? "";
        color.setAttribute("aria-label", color.title);
        color.setAttribute("aria-haspopup", "menu");
        color.addEventListener("click", () => openColorMenu(color, person, isSelf));
        row.append(color);

        if (isSelf) {
            const rename = document.createElement("button");
            rename.type = "button";
            rename.className = "collab-person-rename bx bx-rename";
            rename.title = strings.rename_self ?? "";
            rename.setAttribute("aria-label", strings.rename_self ?? "");
            rename.addEventListener("click", () => startRename(name, person.name));
            row.append(rename);
        }

        if (person.editing) {
            const editing = document.createElement("span");
            editing.className = "collab-person-editing bx bx-pencil";
            editing.title = strings.editing_now ?? "";
            editing.setAttribute("aria-label", strings.editing_now ?? "");
            row.append(editing);
        }

        return row;
    };

    let colorMenu: HTMLElement | null = null;
    const closeColorMenu = () => {
        colorMenu?.remove();
        colorMenu = null;
    };

    const openColorMenu = (anchor: HTMLElement, person: CollabPerson, isSelf: boolean) => {
        // A second press on the same person closes their menu.
        const reopened = colorMenu?.isConnected && colorMenu.dataset.personId === person.id;
        closeColorMenu();

        if (reopened) {
            return;
        }

        const choose = (color: string | null) => {
            if (isSelf) {
                void updateSelf(bootstrap, { color });
            } else {
                setLocalColor(bootstrap.collabId, person.id, color);
                const presence = lastPresence.get(bootstrap.collabId);

                if (presence) {
                    events.dispatchEvent(new CustomEvent("collab-presence",
                        { detail: withLocalColors(bootstrap.collabId, presence) }));
                }
            }
        };
        const rows: MenuRow[] = [
            {
                kind: "item", label: strings.default_color ?? "", icon: "bx bx-reset",
                run: () => choose(null)
            },
            { kind: "divider" },
            ...COLLAB_PERSON_COLORS.map((color, index): MenuRow => ({
                kind: "item",
                label: strings[`color_${COLLAB_PERSON_COLOR_NAMES[index]}`] ?? "",
                icon: "bx bxs-circle",
                iconColor: color,
                checked: color === person.color,
                run: () => choose(color)
            }))
        ];

        colorMenu = buildMenu(rows, closeColorMenu, anchor.title);
        colorMenu.dataset.personId = person.id;
        document.body.append(colorMenu);
        placeMenu(colorMenu, anchor.getBoundingClientRect());
        colorMenu.querySelector<HTMLButtonElement>("[aria-checked=true], .collab-menu-item")
            ?.focus();
    };

    document.addEventListener("pointerdown", (event) => {
        const target = event.target as Node;

        if (colorMenu && !colorMenu.contains(target)
                && !(target instanceof Element && target.closest(".collab-person-color"))) {
            closeColorMenu();
        }
    });
    // Escape closes the color menu first, then the panel.
    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
            return;
        }

        if (colorMenu?.isConnected) {
            closeColorMenu();
        } else if (panel.isConnected && !renaming) {
            setOpen(false);
            toggle.focus();
        }
    });

    const titleOf = (noteId: string) => {
        const row = [ ...document.querySelectorAll<HTMLElement>("#menu a[data-note-id]") ]
            .find((link) => link.dataset.noteId === noteId);
        const fromTree = row?.querySelector(":scope > span")?.textContent?.trim();

        return titles.get(noteId)
            ?? (fromTree || (noteId === bootstrap.noteId ? bootstrap.title : ""));
    };

    const startRename = (name: HTMLElement, current: string) => {
        renaming = true;
        const input = document.createElement("input");
        input.className = "collab-person-rename-input";
        input.value = current;
        input.maxLength = MAX_COLLAB_NAME_LENGTH;
        input.setAttribute("aria-label", strings.your_name ?? "");

        const finish = async (save: boolean) => {
            if (!renaming) {
                return;
            }

            renaming = false;

            if (save && input.value.trim() !== current) {
                await updateSelf(bootstrap, { name: input.value });
            }

            render();
        };

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Escape") {
                // The field's own keys: Escape leaves the name, not the panel.
                event.preventDefault();
                event.stopPropagation();
                void finish(event.key === "Enter");
            }
        });
        input.addEventListener("blur", () => void finish(true));
        name.replaceWith(input);
        input.focus();
        input.select();
    };

    events.addEventListener("collab-presence", (event) => {
        people = (event as CustomEvent<{ people: CollabPerson[] }>).detail.people;
        render();
    });
    // A removed guest is no longer among the people.
    events.addEventListener("collab-removed", () => {
        closeColorMenu();
        panel.remove();
        toggle.remove();
    });
    events.addEventListener("collab-update", (event) => {
        const { notes } = (event as CustomEvent<{ notes: { noteId: string; title: string }[] }>)
            .detail;

        for (const note of notes) {
            titles.set(note.noteId, note.title);
        }

        render();
    });
}

/** Renames or recolors the page's own person for everyone; the server then sends the list. */
async function updateSelf(
    bootstrap: PeopleBootstrap, changes: { name?: string; color?: string | null }
) {
    try {
        await fetch("api/me", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": bootstrap.csrfToken ?? ""
            },
            body: JSON.stringify(changes)
        });
    } catch (e) {
        console.error(e); // eslint-disable-line no-console
    }
}

interface PresenceMessage {
    type: "collab-presence";
    people: CollabPerson[];
}

interface CursorMessage {
    type: "collab-remote-cursor";
    person: { id: string; color: string };
}

/** The colors this browser gives other people, by collaboration and then by person id. */
const localColors = new Map<string, Record<string, string>>();
/** The last presence each collaboration's server sent, before this browser's colors. */
const lastPresence = new Map<string, PresenceMessage>();

/**
 * Gives the people in a presence or cursor message the colors this browser chose for them; other
 * messages pass through. The message the server sent is left as it was.
 */
export function withLocalColors<T extends { type?: string }>(collabId: string, message: T): T {
    const colors = readLocalColors(collabId);

    if (message.type === "collab-presence") {
        const presence = message as unknown as PresenceMessage;
        lastPresence.set(collabId, presence);

        return {
            ...message,
            people: presence.people.map((person) =>
                ({ ...person, color: colors[person.id] ?? person.color }))
        };
    }

    if (message.type === "collab-remote-cursor") {
        const { person } = message as unknown as CursorMessage;

        return { ...message, person: { ...person, color: colors[person.id] ?? person.color } };
    }

    return message;
}

/** Keeps the color this browser shows another person in, or forgets it for null. */
export function setLocalColor(collabId: string, personId: string, color: string | null) {
    const colors = { ...readLocalColors(collabId) };
    const chosen = normalizeCollabColor(color);

    if (chosen) {
        colors[personId] = chosen;
    } else {
        delete colors[personId];
    }

    localColors.set(collabId, colors);

    try {
        localStorage.setItem(`collab-colors:${collabId}`, JSON.stringify(colors));
    } catch {
        // Without storage, the colors hold until the page reloads.
    }
}

function readLocalColors(collabId: string): Record<string, string> {
    const known = localColors.get(collabId);

    if (known) {
        return known;
    }

    const colors: Record<string, string> = {};

    try {
        const stored = JSON.parse(localStorage.getItem(`collab-colors:${collabId}`) ?? "{}") as
            Record<string, unknown>;

        for (const [ personId, color ] of Object.entries(stored ?? {})) {
            const chosen = normalizeCollabColor(color);

            if (chosen) {
                colors[personId] = chosen;
            }
        }
    } catch {
        // Unreadable or blocked storage: no colors of this browser's own.
    }

    localColors.set(collabId, colors);

    return colors;
}
