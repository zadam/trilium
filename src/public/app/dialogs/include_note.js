import treeService from '../services/tree.js';
import noteAutocompleteService from '../services/note_autocomplete.js';
import utils from "../services/utils.js";
import treeCache from "../services/tree_cache.js";

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

async function includeNote(notePath) {
    const noteId = treeService.getNoteIdFromNotePath(notePath);
    const note = await treeCache.getNote(noteId);

    const boxSize = $("input[name='include-note-box-size']:checked").val();

    if (note.type === 'image') {
        // there's no benefit to use insert note functionlity for images
        // so we'll just add an IMG tag
        textTypeWidget.addImage(noteId);
    }
    else {
        textTypeWidget.addIncludeNote(noteId, boxSize);
    }
}

$form.on('submit', () => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        includeNote(notePath);
    }
    else {
        console.error("No noteId to include.");
    }

    return false;
});