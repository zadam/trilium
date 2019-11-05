import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";
import cloningService from "../services/cloning.js";
import treeUtils from "../services/tree_utils.js";
import noteDetailService from "../services/note_detail.js";
import toastService from "../services/toast.js";
import treeCache from "../services/tree_cache.js";

const $dialog = $("#clone-to-dialog");
const $form = $("#clone-to-form");
const $noteAutoComplete = $("#clone-to-note-autocomplete");
const $clonePrefix = $("#clone-prefix");

let clonedNoteId;

export async function showDialog(noteId) {
    clonedNoteId = noteId || noteDetailService.getActiveTabNoteId();

    if (!clonedNoteId) {
        return;
    }

    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    $noteAutoComplete.val('').focus();

    noteAutocompleteService.initNoteAutocomplete($noteAutoComplete);
    noteAutocompleteService.showRecentNotes($noteAutoComplete);
}

$form.submit(() => {
    const notePath = $noteAutoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        const targetNoteId = treeUtils.getNoteIdFromNotePath(notePath);

        cloningService.cloneNoteTo(clonedNoteId, targetNoteId, $clonePrefix.val()).then(async () => {
            const clonedNote = await treeCache.getNote(clonedNoteId);
            const targetNote = await treeCache.getNote(targetNoteId);

            toastService.showMessage(`Note "${clonedNote.title}" has been cloned into ${targetNote.title}`);
        });
    }
    else {
        console.error("No path to clone to.");
    }

    return false;
});