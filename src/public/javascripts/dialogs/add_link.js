import treeService from '../services/tree.js';
import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#add-link-note-autocomplete");
const $linkTitle = $("#link-title");
const $addLinkTitleFormGroup = $("#add-link-title-form-group");

export async function showDialog() {
    utils.closeActiveDialog();

    appContext.trigger('executeInActiveEditor', {
        callback: textEditor => {
            const hasSelection = !textEditor.model.document.selection.isCollapsed;

            $addLinkTitleFormGroup.toggle(!hasSelection);
        }
    });

    glob.activeDialog = $dialog;

    $dialog.modal();

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

        appContext.trigger(`addLinkToActiveEditor`, {
            linkTitle: $linkTitle.val(),
            linkHref: '#' + notePath
        });
    }
    else {
        console.error("No path to add link.");
    }

    return false;
});