import treeService from '../services/tree.js';
import noteAutocompleteService from '../services/note_autocomplete.js';
import utils from "../services/utils.js";

const $dialog = $("#include-note-dialog");
const $form = $("#include-note-form");
const $autoComplete = $("#include-note-autocomplete");
let callback = null;

export async function showDialog(cb) {
    callback = cb;

    $autoComplete.val('');

    utils.openDialog($dialog);

    noteAutocompleteService.initNoteAutocomplete($autoComplete, { hideGoToSelectedNoteButton: true });
    noteAutocompleteService.showRecentNotes($autoComplete);
}

$form.on('submit', () => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        if (callback) {
            callback(treeService.getNoteIdFromNotePath(notePath));
        }
    }
    else {
        console.error("No noteId to include.");
    }

    return false;
});