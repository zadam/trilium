import treeService from '../services/tree.js';
import server from '../services/server.js';
import treeUtils from "../services/tree_utils.js";
import exportService from "../services/export.js";

const $dialog = $("#export-subtree-dialog");
const $form = $("#export-subtree-form");
const $noteTitle = $dialog.find(".note-title");

async function showDialog() {
    glob.activeDialog = $dialog;

    $dialog.modal();

    const currentNode = treeService.getCurrentNode();
    const noteTitle = await treeUtils.getNoteTitle(currentNode.data.noteId);

    $noteTitle.html(noteTitle);
}

$form.submit(() => {
    const exportFormat = $dialog.find("input[name='export-format']:checked").val();

    const currentNode = treeService.getCurrentNode();

    exportService.exportSubtree(currentNode.data.branchId, exportFormat);

    $dialog.modal('hide');

    return false;
});

export default {
    showDialog
};