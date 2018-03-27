import treeService from '../services/tree.js';
import server from '../services/server.js';
import treeCache from "../services/tree_cache.js";
import treeUtils from "../services/tree_utils.js";

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
    const branch = await treeCache.getBranch(branchId);

    $treePrefixInput.val(branch.prefix).focus();

    const noteTitle = treeUtils.getNoteTitle(currentNode.data.noteId);

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