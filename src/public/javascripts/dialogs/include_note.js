import treeUtils from '../services/tree_utils.js';
import noteAutocompleteService from '../services/note_autocomplete.js';
import utils from "../services/utils.js";

const $dialog = $("#include-note-dialog");
const $form = $("#include-note-form");
const $autoComplete = $("#include-note-autocomplete");
let callback = null;

export async function showDialog(cb) {
    callback = cb;

    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $autoComplete.val('');

    $dialog.modal();

    noteAutocompleteService.initNoteAutocomplete($autoComplete, { hideGoToSelectedNoteButton: true });
    noteAutocompleteService.showRecentNotes($autoComplete);
}

$form.on('submit', () => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        if (callback) {
            callback(treeUtils.getNoteIdFromNotePath(notePath));
        }
    }
    else {
        console.error("No noteId to include.");
    }

    return false;
});