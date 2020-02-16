import treeService from '../services/tree.js';
import noteAutocompleteService from '../services/note_autocomplete.js';
import utils from "../services/utils.js";

const $dialog = $("#include-note-dialog");
const $form = $("#include-note-form");
const $autoComplete = $("#include-note-autocomplete");

/** @var TextTypeWidget */
let textTypeWidget;

export async function showDialog(widget) {
    textTypeWidget = widget;

    $autoComplete.val('');

    utils.openDialog($dialog);

    noteAutocompleteService.initNoteAutocomplete($autoComplete, { hideGoToSelectedNoteButton: true });
    noteAutocompleteService.showRecentNotes($autoComplete);
}

$form.on('submit', () => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        const includedNoteId = treeService.getNoteIdFromNotePath(notePath);

        textTypeWidget.addIncludeNote(includedNoteId);
    }
    else {
        console.error("No noteId to include.");
    }

    return false;
});