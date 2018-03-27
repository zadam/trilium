import treeService from '../services/tree.js';
import cloningService from '../services/cloning.js';
import linkService from '../services/link.js';
import noteDetailService from '../services/note_detail.js';
import treeUtils from '../services/tree_utils.js';
import autocompleteService from '../services/autocomplete.js';

const $dialog = $("#add-link-dialog");
const $form = $("#add-link-form");
const $autoComplete = $("#note-autocomplete");
const $linkTitle = $("#link-title");
const $clonePrefix = $("#clone-prefix");
const $linkTitleFormGroup = $("#add-link-title-form-group");
const $prefixFormGroup = $("#add-link-prefix-form-group");
const $linkTypes = $("input[name='add-link-type']");
const $linkTypeHtml = $linkTypes.filter('input[value="html"]');

function setLinkType(linkType) {
    $linkTypes.each(function () {
        $(this).prop('checked', $(this).val() === linkType);
    });

    linkTypeChanged();
}

async function showDialog() {
    glob.activeDialog = $dialog;

    if (noteDetailService.getCurrentNoteType() === 'text') {
        $linkTypeHtml.prop('disabled', false);

        setLinkType('html');
    }
    else {
        $linkTypeHtml.prop('disabled', true);

        setLinkType('selected-to-current');
    }

    $dialog.dialog({
        modal: true,
        width: 700
    });

    $autoComplete.val('').focus();
    $clonePrefix.val('');
    $linkTitle.val('');

    function setDefaultLinkTitle(noteId) {
        const noteTitle = treeUtils.getNoteTitle(noteId);

        $linkTitle.val(noteTitle);
    }

    $autoComplete.autocomplete({
        source: await autocompleteService.getAutocompleteItems(),
        minLength: 0,
        change: () => {
            const val = $autoComplete.val();
            const notePath = linkService.getNodePathFromLabel(val);
            if (!notePath) {
                return;
            }

            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            if (noteId) {
                setDefaultLinkTitle(noteId);
            }
        },
        // this is called when user goes through autocomplete list with keyboard
        // at this point the item isn't selected yet so we use supplied ui.item to see WHERE the cursor is
        focus: (event, ui) => {
            const notePath = linkService.getNodePathFromLabel(ui.item.value);
            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            setDefaultLinkTitle(noteId);
        }
    });
}

$form.submit(() => {
    const value = $autoComplete.val();

    const notePath = linkService.getNodePathFromLabel(value);
    const noteId = treeUtils.getNoteIdFromNotePath(notePath);

    if (notePath) {
        const linkType = $("input[name='add-link-type']:checked").val();

        if (linkType === 'html') {
            const linkTitle = $linkTitle.val();

            $dialog.dialog("close");

            linkService.addLinkToEditor(linkTitle, '#' + notePath);
        }
        else if (linkType === 'selected-to-current') {
            const prefix = $clonePrefix.val();

            cloningService.cloneNoteTo(noteId, noteDetailService.getCurrentNoteId(), prefix);

            $dialog.dialog("close");
        }
        else if (linkType === 'current-to-selected') {
            const prefix = $clonePrefix.val();

            cloningService.cloneNoteTo(noteDetailService.getCurrentNoteId(), noteId, prefix);

            $dialog.dialog("close");
        }
    }

    return false;
});

function linkTypeChanged() {
    const value = $linkTypes.filter(":checked").val();

    if (value === 'html') {
        $linkTitleFormGroup.show();
        $prefixFormGroup.hide();
    }
    else {
        $linkTitleFormGroup.hide();
        $prefixFormGroup.show();
    }
}

$linkTypes.change(linkTypeChanged);

export default {
    showDialog
};