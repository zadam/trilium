import cloningService from '../services/cloning.js';
import linkService from '../services/link.js';
import noteDetailService from '../services/note_detail.js';
import treeUtils from '../services/tree_utils.js';
import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#note-autocomplete");
const $linkTitle = $("#link-title");
const $clonePrefix = $("#clone-prefix");
const $linkTitleFormGroup = $("#add-link-title-form-group");
const $prefixFormGroup = $("#add-link-prefix-form-group");
const $linkTypeDiv = $("#add-link-type-div");
const $linkTypes = $("input[name='add-link-type']");
const $linkTypeHtml = $linkTypes.filter('input[value="html"]');

function setLinkType(linkType) {
    $linkTypes.each(function () {
        $(this).prop('checked', $(this).val() === linkType);
    });

    linkTypeChanged();
}

async function showDialogForClone() {
    showDialog('selected-to-active');
}

async function showDialog(linkType) {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    if (noteDetailService.getActiveNoteType() === 'text') {
        $linkTypeHtml.prop('disabled', false);

        setLinkType('html');
    }
    else {
        $linkTypeHtml.prop('disabled', true);

        setLinkType('selected-to-active');
    }

    if (linkType === 'selected-to-active') {
        setLinkType(linkType);
    }

    $dialog.modal();

    $autoComplete.val('').focus();
    $clonePrefix.val('');
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
    const noteId = treeUtils.getNoteIdFromNotePath(notePath);

    if (notePath) {
        const linkType = $("input[name='add-link-type']:checked").val();

        if (linkType === 'html') {
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
        else if (linkType === 'selected-to-active') {
            const prefix = $clonePrefix.val();

            cloningService.cloneNoteTo(noteId, noteDetailService.getActiveNoteId(), prefix);

            $dialog.modal('hide');
        }
        else if (linkType === 'active-to-selected') {
            const prefix = $clonePrefix.val();

            cloningService.cloneNoteTo(noteDetailService.getActiveNoteId(), noteId, prefix);

            $dialog.modal('hide');
        }
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

function linkTypeChanged() {
    const value = $linkTypes.filter(":checked").val();

    $linkTitleFormGroup.toggle(!hasSelection() && value === 'html');
    $prefixFormGroup.toggle(!hasSelection() && value !== 'html');

    $linkTypeDiv.toggle(!hasSelection());
}

$linkTypes.change(linkTypeChanged);

export default {
    showDialog,
    showDialogForClone
};