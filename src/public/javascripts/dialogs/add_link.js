import cloningService from '../services/cloning.js';
import linkService from '../services/link.js';
import noteDetailService from '../services/note_detail.js';
import treeUtils from '../services/tree_utils.js';
import server from "../services/server.js";
import noteDetailText from "../services/note_detail_text.js";

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

    async function setDefaultLinkTitle(noteId) {
        const noteTitle = await treeUtils.getNoteTitle(noteId);

        $linkTitle.val(noteTitle);
    }

    $autoComplete.autocomplete({
        source: async function(request, response) {
            const result = await server.get('autocomplete?query=' + encodeURIComponent(request.term));

            response(result);
        },
        minLength: 2,
        change: async () => {
            const val = $autoComplete.val();
            const notePath = linkService.getNodePathFromLabel(val);
            if (!notePath) {
                return;
            }

            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            if (noteId) {
                await setDefaultLinkTitle(noteId);
            }
        },
        // this is called when user goes through autocomplete list with keyboard
        // at this point the item isn't selected yet so we use supplied ui.item to see WHERE the cursor is
        focus: async (event, ui) => {
            const notePath = linkService.getNodePathFromLabel(ui.item.value);
            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            await setDefaultLinkTitle(noteId);
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

            const linkHref = '#' + notePath;

            if (hasSelection()) {
                const editor = noteDetailText.getEditor();

                editor.execute('link', linkHref);
            }
            else {
                linkService.addLinkToEditor(linkTitle, linkHref);
            }
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

// returns true if user selected some text, false if there's no selection
function hasSelection() {
    const model = noteDetailText.getEditor().model;
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
    showDialog
};