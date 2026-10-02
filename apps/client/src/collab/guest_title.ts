import type { GuestSaver } from "./guest_saver.js";

/**
 * The key under which "+" in the tree names the note it just created, so that its page selects
 * the title. Matches `NEW_NOTE_KEY` in the share theme's `collab.ts`.
 */
export const NEW_NOTE_KEY = "collab-new-note";

/** Where the title hands over to when Enter is pressed: the start of the note's content. */
export interface TitleHandoff {
    focusStart(): void;
}

/**
 * Makes the page's title editable the way the app's title box is: typing saves it, Enter moves
 * to the start of the content, and leaving the title saves it at once.
 */
export function makeTitleEditable(
    saver: Pick<GuestSaver, "scheduleTitle" | "flush">, content: TitleHandoff
) {
    const title = document.getElementById("title");

    if (!title) {
        return;
    }

    title.contentEditable = "true";
    title.spellcheck = true;
    title.addEventListener("input", () => {
        saver.scheduleTitle(() => title.textContent?.trim() ?? "");
    });
    title.addEventListener("keydown", (event) => {
        // An Enter that confirms an input method's composition belongs to the composition.
        if (event.key !== "Enter" || event.isComposing) {
            return;
        }

        event.preventDefault();
        content.focusStart();
    });
    title.addEventListener("blur", () => void saver.flush());
}

/**
 * Focuses the title of a note that "+" in the tree just created, with its text selected so that
 * typing replaces "New note", as the app does with a new note's title.
 */
export function focusTitleIfNew(noteId: string) {
    let created: string | null;

    try {
        created = sessionStorage.getItem(NEW_NOTE_KEY);
        sessionStorage.removeItem(NEW_NOTE_KEY);
    } catch {
        return;
    }

    const title = document.getElementById("title");

    if (created !== noteId || !title) {
        return;
    }

    title.focus();
    const range = document.createRange();
    range.selectNodeContents(title);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}
