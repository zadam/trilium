import noteAutocompleteService from "../services/note_autocomplete.js";
import utils from "../services/utils.js";
import treeService from "../services/tree.js";
import toastService from "../services/toast.js";
import froca from "../services/froca.js";
import branchService from "../services/branches.js";
import appContext from "../services/app_context.js";

const $dialog = $("#clone-to-dialog");
const $form = $("#clone-to-form");
const $noteAutoComplete = $("#clone-to-note-autocomplete");
const $clonePrefix = $("#clone-prefix");
const $noteList = $("#clone-to-note-list");

let clonedNoteIds;

export async function showDialog(noteIds) {
    if (!noteIds || noteIds.length === 0) {
        noteIds = [ appContext.tabManager.getActiveContextNoteId() ];
    }

    clonedNoteIds = [];

    for (const noteId of noteIds) {
        if (!clonedNoteIds.includes(noteId)) {
            clonedNoteIds.push(noteId);
        }
    }

    utils.openDialog($dialog);

    $noteAutoComplete.val('').trigger('focus');

    $noteList.empty();

    for (const noteId of clonedNoteIds) {
        const note = await froca.getNote(noteId);

        $noteList.append($("<li>").text(note.title));
    }

    noteAutocompleteService.initNoteAutocomplete($noteAutoComplete);
    noteAutocompleteService.showRecentNotes($noteAutoComplete);
}

async function cloneNotesTo(notePath) {
    const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);
    const targetBranchId = await froca.getBranchId(parentNoteId, noteId);

    for (const cloneNoteId of clonedNoteIds) {
        await branchService.cloneNoteToBranch(cloneNoteId, targetBranchId, $clonePrefix.val());

        const clonedNote = await froca.getNote(cloneNoteId);
        const targetNote = await froca.getBranch(targetBranchId).getNote();

        toastService.showMessage(`Note "${clonedNote.title}" has been cloned into ${targetNote.title}`);
    }
}

$form.on('submit', () => {
    const notePath = $noteAutoComplete.getSelectedNotePath();

    if (notePath) {
        $dialog.modal('hide');

        cloneNotesTo(notePath);
    }
    else {
        logError("No path to clone to.");
    }

    return false;
});
