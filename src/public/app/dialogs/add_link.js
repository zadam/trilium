import treeService from '../services/tree.js';
import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#add-link-note-autocomplete");
const $linkTitle = $("#link-title");
const $addLinkTitleSettings = $("#add-link-title-settings");
const $addLinkTitleRadios = $(".add-link-title-radios");
const $addLinkTitleFormGroup = $("#add-link-title-form-group");

/** @var TextTypeWidget */
let textTypeWidget;

export async function showDialog(widget, text = '') {
    textTypeWidget = widget;

    $addLinkTitleSettings.toggle(!textTypeWidget.hasSelection());

    $addLinkTitleSettings.find('input[type=radio]').on('change', updateTitleSettingsVisibility);

    // with selection hyper link is implied
    if (textTypeWidget.hasSelection()) {
        $addLinkTitleSettings.find("input[value='hyper-link']").prop("checked", true);
    }
    else {
        $addLinkTitleSettings.find("input[value='reference-link']").prop("checked", true);
    }

    updateTitleSettingsVisibility();

    utils.openDialog($dialog);

    $autoComplete.val('');
    $linkTitle.val('');

    async function setDefaultLinkTitle(noteId) {
        const noteTitle = await treeService.getNoteTitle(noteId);

        $linkTitle.val(noteTitle);
    }

    noteAutocompleteService.initNoteAutocomplete($autoComplete, {
        allowExternalLinks: true,
        allowCreatingNotes: true
    });

    $autoComplete.on('autocomplete:noteselected', (event, suggestion, dataset) => {
        if (!suggestion.notePath) {
            return false;
        }

        updateTitleSettingsVisibility();

        const noteId = treeService.getNoteIdFromNotePath(suggestion.notePath);

        if (noteId) {
            setDefaultLinkTitle(noteId);
        }
    });

    $autoComplete.on('autocomplete:externallinkselected', (event, suggestion, dataset) => {
        if (!suggestion.externalLink) {
            return false;
        }

        updateTitleSettingsVisibility();

        $linkTitle.val(suggestion.externalLink);
    });

    $autoComplete.on('autocomplete:cursorchanged',  function(event, suggestion, dataset) {
        if (suggestion.externalLink) {
            $linkTitle.val(suggestion.externalLink)
        }
        else {
            const noteId = treeService.getNoteIdFromNotePath(suggestion.notePath);

            if (noteId) {
                setDefaultLinkTitle(noteId);
            }
        }
    });

    if (text && text.trim()) {
        noteAutocompleteService.setText($autoComplete, text);
    }
    else {
        noteAutocompleteService.showRecentNotes($autoComplete);
    }

    $autoComplete
        .trigger('focus')
        .trigger('select'); // to be able to quickly remove entered text
}

function getLinkType() {
    if ($autoComplete.getSelectedExternalLink()) {
        return 'external-link';
    }

    return $addLinkTitleSettings.find('input[type=radio]:checked').val();
}

function updateTitleSettingsVisibility() {
    const linkType = getLinkType();

    $addLinkTitleFormGroup.toggle(linkType !== 'reference-link');
    $addLinkTitleRadios.toggle(linkType !== 'external-link')
}

$form.on('submit', () => {
    if ($autoComplete.getSelectedNotePath()) {
        $dialog.modal('hide');

        const linkTitle = getLinkType() === 'reference-link' ? null : $linkTitle.val();

        textTypeWidget.addLink($autoComplete.getSelectedNotePath(), linkTitle);
    }
    else if ($autoComplete.getSelectedExternalLink()) {
        $dialog.modal('hide');

        textTypeWidget.addLink($autoComplete.getSelectedExternalLink(), $linkTitle.val());
    }
    else {
        logError("No link to add.");
    }

    return false;
});
