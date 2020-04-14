import treeService from '../services/tree.js';
import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#add-link-note-autocomplete");
const $linkTitle = $("#link-title");
const $addLinkTitleSettings = $("#add-link-title-settings");
const $addLinkTitleFormGroup = $("#add-link-title-form-group");

/** @var TextTypeWidget */
let textTypeWidget;

export async function showDialog(widget) {
    textTypeWidget = widget;

    $addLinkTitleSettings.toggle(!textTypeWidget.hasSelection());

    updateTitleFormGroupVisibility();
    $addLinkTitleSettings.find('input[type=radio]').on('change', updateTitleFormGroupVisibility);

    // with selection hyper link is implied
    if (textTypeWidget.hasSelection()) {
        $addLinkTitleSettings.find("input[value='hyper-link']").prop("checked", true);
    }
    else {
        $addLinkTitleSettings.find("input[value='reference-link']").prop("checked", true);
    }

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

        if (noteId) {
            setDefaultLinkTitle(noteId);
        }
    });

    noteAutocompleteService.showRecentNotes($autoComplete);
}

function getLinkType() {
    return $addLinkTitleSettings.find('input[type=radio]:checked').val();
}

function updateTitleFormGroupVisibility() {
    const visible = getLinkType() === 'hyper-link';

    $addLinkTitleFormGroup.toggle(visible);
}

$form.on('submit', () => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        const linkTitle = getLinkType() === 'reference-link' ? null : $linkTitle.val();

        textTypeWidget.addLink(notePath, linkTitle);
    }
    else {
        console.error("No path to add link.");
    }

    return false;
});