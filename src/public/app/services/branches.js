import utils from './utils.js';
import server from './server.js';
import toastService from "./toast.js";
import froca from "./froca.js";
import hoistedNoteService from "./hoisted_note.js";
import ws from "./ws.js";
import appContext from "./app_context.js";

async function moveBeforeBranch(branchIdsToMove, beforeBranchId) {
    branchIdsToMove = filterRootNote(branchIdsToMove);
    branchIdsToMove = filterSearchBranches(branchIdsToMove);

    if (beforeBranchId === 'root') {
        toastService.showError('Cannot move notes before root note.');
        return;
    }

    for (const branchIdToMove of branchIdsToMove) {
        const resp = await server.put(`branches/${branchIdToMove}/move-before/${beforeBranchId}`);

        if (!resp.success) {
            toastService.showError(resp.message);
            return;
        }
    }
}

async function moveAfterBranch(branchIdsToMove, afterBranchId) {
    branchIdsToMove = filterRootNote(branchIdsToMove);
    branchIdsToMove = filterSearchBranches(branchIdsToMove);

    const afterNote = await froca.getBranch(afterBranchId).getNote();

    if (afterNote.noteId === 'root' || afterNote.noteId === hoistedNoteService.getHoistedNoteId()) {
        toastService.showError('Cannot move notes after root note.');
        return;
    }

    branchIdsToMove.reverse(); // need to reverse to keep the note order

    for (const branchIdToMove of branchIdsToMove) {
        const resp = await server.put(`branches/${branchIdToMove}/move-after/${afterBranchId}`);

        if (!resp.success) {
            toastService.showError(resp.message);
            return;
        }
    }
}

async function moveToParentNote(branchIdsToMove, newParentBranchId) {
    branchIdsToMove = filterRootNote(branchIdsToMove);

    for (const branchIdToMove of branchIdsToMove) {
        const branchToMove = froca.getBranch(branchIdToMove);

        if (branchToMove.noteId === hoistedNoteService.getHoistedNoteId()
            || (await branchToMove.getParentNote()).type === 'search') {
            continue;
        }

        const resp = await server.put(`branches/${branchIdToMove}/move-to/${newParentBranchId}`);

        if (!resp.success) {
            toastService.showError(resp.message);
            return;
        }
    }
}

async function deleteNotes(branchIdsToDelete, forceDeleteAllClones = false) {
    branchIdsToDelete = filterRootNote(branchIdsToDelete);

    if (branchIdsToDelete.length === 0) {
        return false;
    }

    let proceed, deleteAllClones, eraseNotes;

    if (utils.isMobile()) {
        proceed = true;
        deleteAllClones = false;
    }
    else {
        ({proceed, deleteAllClones, eraseNotes} = await new Promise(res =>
            appContext.triggerCommand('showDeleteNotesDialog', {branchIdsToDelete, callback: res, forceDeleteAllClones})));
    }

    if (!proceed) {
        return false;
    }

    const taskId = utils.randomString(10);

    let counter = 0;

    for (const branchIdToDelete of branchIdsToDelete) {
        counter++;

        const last = counter === branchIdsToDelete.length;
        const query = `?taskId=${taskId}&eraseNotes=${eraseNotes ? 'true' : 'false'}&last=${last ? 'true' : 'false'}`;

        const branch = froca.getBranch(branchIdToDelete);

        if (deleteAllClones) {
            await server.remove(`notes/${branch.noteId}` + query);
        }
        else {
            await server.remove(`branches/${branchIdToDelete}` + query);
        }
    }

    if (eraseNotes) {
        utils.reloadFrontendApp("erasing notes requires reload");
    }

    return true;
}

async function moveNodeUpInHierarchy(node) {
    if (hoistedNoteService.isHoistedNode(node)
        || hoistedNoteService.isTopLevelNode(node)
        || node.getParent().data.noteType === 'search') {
        return;
    }

    const resp = await server.put('branches/' + node.data.branchId + '/move-after/' + node.getParent().data.branchId);

    if (!resp.success) {
        toastService.showError(resp.message);
        return;
    }

    if (!hoistedNoteService.isTopLevelNode(node) && node.getParent().getChildren().length <= 1) {
        node.getParent().folder = false;
        node.getParent().renderTitle();
    }
}

function filterSearchBranches(branchIds) {
    return branchIds.filter(branchId => !branchId.startsWith('virt-'));
}

function filterRootNote(branchIds) {
    const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

    return branchIds.filter(branchId => {
       const branch = froca.getBranch(branchId);

        return branch.noteId !== 'root'
            && branch.noteId !== hoistedNoteId;
    });
}

function makeToast(id, message) {
    return {
        id: id,
        title: "Delete status",
        message: message,
        icon: "trash"
    };
}

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'delete-notes') {
        return;
    }

    if (message.type === 'taskError') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'taskProgressCount') {
        toastService.showPersistent(makeToast(message.taskId, "Delete notes in progress: " + message.progressCount));
    } else if (message.type === 'taskSucceeded') {
        const toast = makeToast(message.taskId, "Delete finished successfully.");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});

ws.subscribeToMessages(async message => {
    if (message.taskType !== 'undeleteNotes') {
        return;
    }

    if (message.type === 'taskError') {
        toastService.closePersistent(message.taskId);
        toastService.showError(message.message);
    } else if (message.type === 'taskProgressCount') {
        toastService.showPersistent(makeToast(message.taskId, "Undeleting notes in progress: " + message.progressCount));
    } else if (message.type === 'taskSucceeded') {
        const toast = makeToast(message.taskId, "Undeleting notes finished successfully.");
        toast.closeAfter = 5000;

        toastService.showPersistent(toast);
    }
});

async function cloneNoteToBranch(childNoteId, parentBranchId, prefix) {
    const resp = await server.put(`notes/${childNoteId}/clone-to-branch/${parentBranchId}`, {
        prefix: prefix
    });

    if (!resp.success) {
        toastService.showError(resp.message);
    }
}

async function cloneNoteToNote(childNoteId, parentNoteId, prefix) {
    const resp = await server.put(`notes/${childNoteId}/clone-to-note/${parentNoteId}`, {
        prefix: prefix
    });

    if (!resp.success) {
        toastService.showError(resp.message);
    }
}

// beware that first arg is noteId and second is branchId!
async function cloneNoteAfter(noteId, afterBranchId) {
    const resp = await server.put('notes/' + noteId + '/clone-after/' + afterBranchId);

    if (!resp.success) {
        toastService.showError(resp.message);
    }
}

export default {
    moveBeforeBranch,
    moveAfterBranch,
    moveToParentNote,
    deleteNotes,
    moveNodeUpInHierarchy,
    cloneNoteAfter,
    cloneNoteToBranch,
    cloneNoteToNote,
};
