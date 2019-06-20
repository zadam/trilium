import treeService from '../services/tree.js';
import server from '../services/server.js';
import treeCache from "../services/tree_cache.js";
import treeUtils from "../services/tree_utils.js";
import infoService from "../services/info.js";
import utils from "../services/utils.js";

const $dialog = $("#branch-prefix-dialog");
const $form = $("#branch-prefix-form");
const $treePrefixInput = $("#branch-prefix-input");
const $noteTitle = $('#branch-prefix-note-title');

let branchId;

async function showDialog(node) {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    $dialog.modal();

    branchId = node.data.branchId;
    const branch = await treeCache.getBranch(branchId);

    $treePrefixInput.val(branch.prefix);

    const noteTitle = await treeUtils.getNoteTitle(node.data.noteId);

    $noteTitle.text(" - " + noteTitle);
}

async function savePrefix() {
    const prefix = $treePrefixInput.val();

    await server.put('branches/' + branchId + '/set-prefix', { prefix: prefix });

    await treeService.setPrefix(branchId, prefix);

    $dialog.modal('hide');

    infoService.showMessage("Branch prefix has been saved.");
}

$form.submit(() => {
    savePrefix();

    return false;
});

$dialog.on('shown.bs.modal', () => $treePrefixInput.focus());

export default {
    showDialog
};