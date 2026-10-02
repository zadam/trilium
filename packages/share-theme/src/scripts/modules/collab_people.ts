import { type CollabPerson, MAX_COLLAB_NAME_LENGTH } from "@triliumnext/commons/src/lib/collab.js";

/** The part of `window.collab` the people panel reads. */
export interface PeopleBootstrap {
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
 * Lists the people on the collaboration's pages at the foot of the sidebar: each with their color
 * and initial, the note they are on when there are several, and a pencil while they edit. The
 * page's own row says so and offers a rename. Names only ever reach the page as text.
 */
export function setupPeople(bootstrap: PeopleBootstrap, events: EventTarget) {
    const pane = document.getElementById("left-pane");

    if (!pane) {
        return;
    }

    const { strings } = bootstrap;
    const panel = document.createElement("section");
    panel.className = "collab-people";
    panel.hidden = true;
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
    pane.append(panel);

    let people: CollabPerson[] = [];
    let renaming = false;
    /** Note titles the live updates brought, newer than the tree's until it refreshes. */
    const titles = new Map<string, string>();

    const render = () => {
        if (renaming) {
            return;
        }

        count.textContent = String(people.length);
        list.replaceChildren(...people.map((person) => renderPerson(person)));
        panel.hidden = people.length === 0;
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

        if (person.editing) {
            const editing = document.createElement("span");
            editing.className = "collab-person-editing bx bx-pencil";
            editing.title = strings.editing_now ?? "";
            editing.setAttribute("aria-label", strings.editing_now ?? "");
            row.append(editing);
        }

        if (isSelf) {
            const rename = document.createElement("button");
            rename.type = "button";
            rename.className = "collab-person-rename bx bx-rename";
            rename.title = strings.rename_self ?? "";
            rename.setAttribute("aria-label", strings.rename_self ?? "");
            rename.addEventListener("click", () => startRename(name, person.name));
            row.append(rename);
        }

        return row;
    };

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
                await renameSelf(bootstrap, input.value);
            }

            render();
        };

        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Escape") {
                event.preventDefault();
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
    events.addEventListener("collab-removed", () => panel.remove());
    events.addEventListener("collab-update", (event) => {
        const { notes } = (event as CustomEvent<{ notes: { noteId: string; title: string }[] }>)
            .detail;

        for (const note of notes) {
            titles.set(note.noteId, note.title);
        }

        render();
    });
}

async function renameSelf(bootstrap: PeopleBootstrap, name: string) {
    try {
        await fetch("api/me", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "x-csrf-token": bootstrap.csrfToken ?? ""
            },
            body: JSON.stringify({ name })
        });
    } catch (e) {
        console.error(e); // eslint-disable-line no-console
    }
}
