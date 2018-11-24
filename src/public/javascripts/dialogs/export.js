import treeService from '../services/tree.js';
import treeUtils from "../services/tree_utils.js";
import exportService from "../services/export.js";

const $dialog = $("#export-dialog");
const $form = $("#export-form");
const $noteTitle = $dialog.find(".note-title");
const $subtreeFormats = $("#export-subtree-formats");
const $singleFormats = $("#export-single-formats");
const $subtreeType = $("#export-type-subtree");
const $singleType = $("#export-type-single");

async function showDialog(defaultType) {
    if (defaultType === 'subtree') {
        $subtreeType.prop("checked", true).change();
    }
    else if (defaultType === 'single') {
        $singleType.prop("checked", true).change();
    }
    else {
        throw new Error("Unrecognized type " + defaultType);
    }

    glob.activeDialog = $dialog;

    $dialog.modal();

    const currentNode = treeService.getCurrentNode();
    const noteTitle = await treeUtils.getNoteTitle(currentNode.data.noteId);

    $noteTitle.html(noteTitle);
}

$form.submit(() => {
    const exportType = $dialog.find("input[name='export-type']:checked").val();

    const currentNode = treeService.getCurrentNode();

    exportService.exportNote(currentNode.data.branchId, exportType);

    $dialog.modal('hide');

    return false;
});

$('input[name=export-type]').change(function () {
    if (this.value === 'subtree') {
        if ($("input[name=export-subtree-format]:checked").length === 0) {
            $("input[name=export-subtree-format]:first").prop("checked", true);
        }

        $subtreeFormats.slideDown();
        $singleFormats.slideUp();
    }
    else {
        if ($("input[name=export-single-format]:checked").length === 0) {
            $("input[name=export-single-format]:first").prop("checked", true);
        }

        $subtreeFormats.slideUp();
        $singleFormats.slideDown();
    }
});

export default {
    showDialog
};