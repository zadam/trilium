import branchService from "./branches.js";
import toastService from "./toast.js";
import hoistedNoteService from "./hoisted_note.js";
import treeCache from "./tree_cache.js";

let clipboardBranchIds = [];
let clipboardMode = null;

async function pasteAfter(afterBranchId) {
    if (isClipboardEmpty()) {
        return;
    }

    if (clipboardMode === 'cut') {
        await branchService.moveAfterBranch(clipboardBranchIds, afterBranchId);

        clipboardBranchIds = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        const clipboardBranches = clipboardBranchIds.map(branchId => treeCache.getBranch(branchId));

        for (const clipboardBranch of clipboardBranches) {
            const clipboardNote = await clipboardBranch.getNote();

            await branchService.cloneNoteAfter(clipboardNote.noteId, afterBranchId);
        }

        // copy will keep clipboardBranchIds and clipboardMode so it's possible to paste into multiple places
    }
    else {
        toastService.throwError("Unrecognized clipboard mode=" + clipboardMode);
    }
}

async function pasteInto(parentBranchId) {
    if (isClipboardEmpty()) {
        return;
    }

    if (clipboardMode === 'cut') {
        await branchService.moveToParentNote(clipboardBranchIds, parentBranchId);

        clipboardBranchIds = [];
        clipboardMode = null;
    }
    else if (clipboardMode === 'copy') {
        const clipboardBranches = clipboardBranchIds.map(branchId => treeCache.getBranch(branchId));

        for (const clipboardBranch of clipboardBranches) {
            const clipboardNote = await clipboardBranch.getNote();

            await branchService.cloneNoteTo(clipboardNote.noteId, parentBranchId);
        }

        // copy will keep clipboardBranchIds and clipboardMode so it's possible to paste into multiple places
    }
    else {
        toastService.throwError("Unrecognized clipboard mode=" + mode);
    }
}

function copy(branchIds) {
    clipboardBranchIds = branchIds;
    clipboardMode = 'copy';

    toastService.showMessage("Note(s) have been copied into clipboard.");
}

function cut(branchIds) {
    clipboardBranchIds = branchIds;

    if (clipboardBranchIds.length > 0) {
        clipboardMode = 'cut';

        toastService.showMessage("Note(s) have been cut into clipboard.");
    }
}

function isClipboardEmpty() {
    clipboardBranchIds = clipboardBranchIds.filter(branchId => !!treeCache.getBranch(branchId));

    return clipboardBranchIds.length === 0;
}

export default {
    pasteAfter,
    pasteInto,
    cut,
    copy,
    isClipboardEmpty
}
