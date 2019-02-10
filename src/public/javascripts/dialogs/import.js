import treeService from '../services/tree.js';
import exportService from "../services/export.js";
import treeUtils from "../services/tree_utils.js";

const $dialog = $("#import-dialog");
const $form = $("#import-form");
const $noteTitle = $dialog.find(".note-title");

async function showDialog() {
    glob.activeDialog = $dialog;

    const currentNode = treeService.getCurrentNode();
    $noteTitle.text(await treeUtils.getNoteTitle(currentNode.data.noteId));

    $dialog.modal();
}

$form.submit(() => {
    const currentNode = treeService.getCurrentNode();

    exportService.importIntoNote(currentNode.data.noteId).then(() => {
        $dialog.modal('hide');
    });

    return false;
});

export default {
    showDialog
}