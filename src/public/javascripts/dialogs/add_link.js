import linkService from '../services/link.js';
import noteDetailService from '../services/note_detail.js';
import treeUtils from '../services/tree_utils.js';
import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#add-link-note-autocomplete");
const $linkTitle = $("#link-title");
const $addLinkTitleFormGroup = $("#add-link-title-form-group");

export async function showDialog() {
    utils.closeActiveDialog();

    $addLinkTitleFormGroup.toggle(!hasSelection());

    glob.activeDialog = $dialog;

    $dialog.modal();

    $autoComplete.val('').focus();
    $linkTitle.val('');

    async function setDefaultLinkTitle(noteId) {
        const noteTitle = await treeUtils.getNoteTitle(noteId);

        $linkTitle.val(noteTitle);
    }

    noteAutocompleteService.initNoteAutocomplete($autoComplete);

    $autoComplete.on('autocomplete:selected', function(event, suggestion, dataset) {
        if (!suggestion.path) {
            return false;
        }

        const noteId = treeUtils.getNoteIdFromNotePath(suggestion.path);

        if (noteId) {
            setDefaultLinkTitle(noteId);
        }
    });

    $autoComplete.on('autocomplete:cursorchanged', function(event, suggestion, dataset) {
        const noteId = treeUtils.getNoteIdFromNotePath(suggestion.path);

        setDefaultLinkTitle(noteId);
    });

    noteAutocompleteService.showRecentNotes($autoComplete);
}

$form.submit(() => {
    const notePath = $autoComplete.getSelectedPath();

    if (notePath) {
        const linkTitle = $linkTitle.val();

        $dialog.modal('hide');

        const linkHref = '#' + notePath;
        const editor = noteDetailService.getActiveEditor();

        if (hasSelection()) {
            editor.execute('link', linkHref);
        }
        else {
            linkService.addLinkToEditor(linkTitle, linkHref);
        }

        editor.editing.view.focus();
    }
    else {
        console.error("No path to add link.");
    }

    return false;
});

// returns true if user selected some text, false if there's no selection
function hasSelection() {
    const model = noteDetailService.getActiveEditor().model;
    const selection = model.document.selection;

    return !selection.isCollapsed;
}