import treeService from '../services/tree.js';
import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#add-link-note-autocomplete");
const $linkTitle = $("#link-title");
const $addLinkTitleFormGroup = $("#add-link-title-form-group");

/** @var TextTypeWidget */
let textTypeWidget;

export async function showDialog(widget) {
    textTypeWidget = widget;

    $addLinkTitleFormGroup.toggle(!textTypeWidget.hasSelection());

    utils.openDialog($dialog);

    $autoComplete.val('').trigger('focus');
    $linkTitle.val('');

    async function setDefaultLinkTitle(noteId) {
        const noteTitle = await treeService.getNoteTitle(noteId);

        $linkTitle.val(noteTitle);
    }

    noteAutocompleteService.initNoteAutocomplete($autoComplete);

    $autoComplete.on('autocomplete:selected', function(event, suggestion, dataset) {
        if (!suggestion.path) {
            return false;
        }

        const noteId = treeService.getNoteIdFromNotePath(suggestion.path);

        if (noteId) {
            setDefaultLinkTitle(noteId);
        }
    });

    $autoComplete.on('autocomplete:cursorchanged', function(event, suggestion, dataset) {
        const noteId = treeService.getNoteIdFromNotePath(suggestion.path);

        setDefaultLinkTitle(noteId);
    });

    noteAutocompleteService.showRecentNotes($autoComplete);
}

$form.on('submit', () => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        textTypeWidget.addLink(notePath, $linkTitle.val());
    }
    else {
        console.error("No path to add link.");
    }

    return false;
});