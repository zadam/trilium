import appContext, { type CommandNames } from "../components/app_context";
import froca from "../services/froca";
import hoistedNoteService from "../services/hoisted_note";
import { t } from "../services/i18n";
import server from "../services/server";
import type { MenuItem } from "./context_menu";
import { notePathMenuItem } from "./context_menu_utils";

/** The number of notes the "Recently changed notes" section lists. */
const RECENT_CHANGES_LIMIT = 15;

/**
 * Returns the "Recently changed notes" menu section: the most recently changed notes that have no
 * open tab, newest first, followed by an entry that opens the Recent changes dialog.
 */
export async function getRecentChangesMenuItems(): Promise<MenuItem<CommandNames>[]> {
    const hoistedNoteId = hoistedNoteService.getHoistedNoteId();
    const openNoteIds = new Set<string>();
    for (const noteContext of appContext.tabManager.getNoteContexts()) {
        if (noteContext.noteId) {
            openNoteIds.add(noteContext.noteId);
        }
    }

    // Requests one extra note per open tab, because open notes are removed from the list.
    const limit = RECENT_CHANGES_LIMIT + openNoteIds.size;
    const noteIds = await server.get<string[]>(
        `recent-changes/${hoistedNoteId}/note-ids?limit=${limit}`
    );
    const notes = await froca.getNotes(
        noteIds.filter((noteId) => !openNoteIds.has(noteId)).slice(0, RECENT_CHANGES_LIMIT),
        true
    );

    const items: MenuItem<CommandNames>[] = [
        { kind: "header", title: t("tab_row.recently_changed_notes") }
    ];
    for (const note of notes) {
        const notePath = note.getBestNotePathString(hoistedNoteId);
        if (!notePath) {
            continue;
        }

        items.push(await notePathMenuItem(notePath, () => {
            void appContext.tabManager.openTabWithNoteWithHoisting(notePath, { activate: true });
        }));
    }

    if (items.length > 1) {
        items.push({ kind: "separator" });
    }
    items.push({
        title: t("tab_row.show_all_recent_changes"),
        command: "showRecentChanges",
        uiIcon: "bx bx-history",
        keyboardShortcut: "showRecentChanges"
    });

    return items;
}
