import treeService from '../services/tree.js';
import server from '../services/server.js';
import treeCache from "../services/tree_cache.js";
import toastService from "../services/toast.js";
import utils from "../services/utils.js";

const $dialog = $("#branch-prefix-dialog");
const $form = $("#branch-prefix-form");
const $treePrefixInput = $("#branch-prefix-input");
const $noteTitle = $('#branch-prefix-note-title');

let branchId;

export async function showDialog(notePath) {
    const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);

    if (!noteId || !parentNoteId) {
        return;
    }

    branchId = await treeCache.getBranchId(parentNoteId, noteId);
    const branch = treeCache.getBranch(branchId);

    if (!branch || branch.noteId === 'root') {
        return;
    }

    const parentNote = await treeCache.getNote(branch.parentNoteId);

    if (parentNote.type === 'search') {
        return;
    }

    utils.openDialog($dialog);

    $treePrefixInput.val(branch.prefix);

    const noteTitle = await treeService.getNoteTitle(noteId);

    $noteTitle.text(" - " + noteTitle);
}

async function savePrefix() {
    const prefix = $treePrefixInput.val();

    await server.put('branches/' + branchId + '/set-prefix', { prefix: prefix });

    $dialog.modal('hide');

    toastService.showMessage("Branch prefix has been saved.");
}

$form.on('submit', () => {
    savePrefix();

    return false;
});

$dialog.on('shown.bs.modal', () => $treePrefixInput.trigger('focus'));