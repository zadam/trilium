import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";
import toastService from "../services/toast.js";
import treeCache from "../services/tree_cache.js";
import branchService from "../services/branches.js";
import treeService from "../services/tree.js";

const $dialog = $("#move-to-dialog");
const $form = $("#move-to-form");
const $noteAutoComplete = $("#move-to-note-autocomplete");
const $noteList = $("#move-to-note-list");

let movedBranchIds;

export async function showDialog(branchIds) {
    movedBranchIds = branchIds;

    utils.openDialog($dialog);

    $noteAutoComplete.val('').trigger('focus');

    $noteList.empty();

    for (const branchId of movedBranchIds) {
        const branch = treeCache.getBranch(branchId);
        const note = await treeCache.getNote(branch.noteId);

        $noteList.append($("<li>").text(note.title));
    }

    noteAutocompleteService.initNoteAutocomplete($noteAutoComplete);
    noteAutocompleteService.showRecentNotes($noteAutoComplete);
}

async function moveNotesTo(parentBranchId) {
    await branchService.moveToParentNote(movedBranchIds, parentBranchId);

    const parentBranch = treeCache.getBranch(parentBranchId);
    const parentNote = await parentBranch.getNote();

    toastService.showMessage(`Selected notes have been moved into ${parentNote.title}`);
}

$form.on('submit', () => {
    const notePath = $noteAutoComplete.getSelectedPath();

    if (notePath) {
        $dialog.modal('hide');

        const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);
        treeCache.getBranchId(parentNoteId, noteId).then(branchId => moveNotesTo(branchId));
    }
    else {
        console.error("No path to move to.");
    }

    return false;
});
