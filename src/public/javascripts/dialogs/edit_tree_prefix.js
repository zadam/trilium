import treeService from '../services/tree.js';
import server from '../services/server.js';

const $dialog = $("#edit-tree-prefix-dialog");
const $form = $("#edit-tree-prefix-form");
const $treePrefixInput = $("#tree-prefix-input");
const $noteTitle = $('#tree-prefix-note-title');

let branchId;

async function showDialog() {
    glob.activeDialog = $dialog;

    await $dialog.dialog({
        modal: true,
        width: 500
    });

    const currentNode = treeService.getCurrentNode();

    branchId = currentNode.data.branchId;
    const branch = await treeService.getBranch(branchId);

    $treePrefixInput.val(branch.prefix).focus();

    const noteTitle = treeService.getNoteTitle(currentNode.data.noteId);

    $noteTitle.html(noteTitle);
}

$form.submit(() => {
    const prefix = $treePrefixInput.val();

    server.put('tree/' + branchId + '/set-prefix', {
        prefix: prefix
    }).then(() => treeService.setPrefix(branchId, prefix));

    $dialog.dialog("close");

    return false;
});

export default {
    showDialog
};