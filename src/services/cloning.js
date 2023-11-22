"use strict";

const sql = require('./sql.js');
const eventChangesService = require('./entity_changes.js');
const treeService = require('./tree.js');
const BBranch = require('../becca/entities/bbranch.js');
const becca = require('../becca/becca.js');
const log = require('./log.js');

function cloneNoteToParentNote(noteId, parentNoteId, prefix = null) {
    if (!(noteId in becca.notes) || !(parentNoteId in becca.notes)) {
        return { success: false, message: 'Note cannot be cloned because either the cloned note or the intended parent is deleted.' };
    }

    const parentNote = becca.getNote(parentNoteId);

    if (parentNote.type === 'search') {
        return {
            success: false,
            message: "Can't clone into a search note"
        };
    }

    const validationResult = treeService.validateParentChild(parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    const branch = new BBranch({
        noteId: noteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        isExpanded: 0
    }).save();

    log.info(`Cloned note '${noteId}' to a new parent note '${parentNoteId}' with prefix '${prefix}'`);

    return {
        success: true,
        branchId: branch.branchId,
        notePath: `${parentNote.getBestNotePathString()}/${noteId}`
    };
}

function cloneNoteToBranch(noteId, parentBranchId, prefix) {
    const parentBranch = becca.getBranch(parentBranchId);

    if (!parentBranch) {
        return { success: false, message: `Parent branch '${parentBranchId}' does not exist.` };
    }

    const ret = cloneNoteToParentNote(noteId, parentBranch.noteId, prefix);

    parentBranch.isExpanded = true; // the new target should be expanded, so it immediately shows up to the user
    parentBranch.save();

    return ret;
}

function ensureNoteIsPresentInParent(noteId, parentNoteId, prefix) {
    if (!(noteId in becca.notes)) {
        return { branch: null, success: false, message: `Note '${noteId}' is deleted.` };
    } else if (!(parentNoteId in becca.notes)) {
        return { branch: null, success: false, message: `Note '${parentNoteId}' is deleted.` };
    }

    const parentNote = becca.getNote(parentNoteId);

    if (parentNote.type === 'search') {
        return { branch: null, success: false, message: "Can't clone into a search note" };
    }

    const validationResult = treeService.validateParentChild(parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    const branch = new BBranch({
        noteId: noteId,
        parentNoteId: parentNoteId,
        prefix: prefix,
        isExpanded: 0
    }).save();

    log.info(`Ensured note '${noteId}' is in parent note '${parentNoteId}' with prefix '${branch.prefix}'`);

    return { branch: branch, success: true };
}

function ensureNoteIsAbsentFromParent(noteId, parentNoteId) {
    const branchId = sql.getValue(`SELECT branchId FROM branches WHERE noteId = ? AND parentNoteId = ? AND isDeleted = 0`, [noteId, parentNoteId]);
    const branch = becca.getBranch(branchId);

    if (branch) {
        if (!branch.isWeak && branch.getNote().getStrongParentBranches().length <= 1) {
            return {
                success: false,
                message: `Cannot remove branch '${branch.branchId}' between child '${noteId}' and parent '${parentNoteId}' because this would delete the note as well.`
            };
        }

        branch.deleteBranch();

        log.info(`Ensured note '${noteId}' is NOT in parent note '${parentNoteId}'`);

        return { success: true };
    }
}

function toggleNoteInParent(present, noteId, parentNoteId, prefix) {
    if (present) {
        return ensureNoteIsPresentInParent(noteId, parentNoteId, prefix);
    }
    else {
        return ensureNoteIsAbsentFromParent(noteId, parentNoteId);
    }
}

function cloneNoteAfter(noteId, afterBranchId) {
    if (['_hidden', 'root'].includes(noteId)) {
        return { success: false, message: `Cloning the note '${noteId}' is forbidden.` };
    }

    const afterBranch = becca.getBranch(afterBranchId);

    if (!afterBranch) {
        return { success: false, message: `Branch '${afterBranchId}' does not exist.` };
    }

    if (afterBranch.noteId === '_hidden') {
        return { success: false, message: 'Cannot clone after the hidden branch.' };
    }

    const afterNote = becca.getBranch(afterBranchId);

    if (!(noteId in becca.notes)) {
        return { success: false, message: `Note to be cloned '${noteId}' is deleted or does not exist.` };
    } else if (!(afterNote.parentNoteId in becca.notes)) {
        return { success: false, message: `After note '${afterNote.parentNoteId}' is deleted or does not exist.` };
    }

    const parentNote = becca.getNote(afterNote.parentNoteId);

    if (parentNote.type === 'search') {
        return {
            success: false,
            message: "Can't clone into a search note"
        };
    }

    const validationResult = treeService.validateParentChild(afterNote.parentNoteId, noteId);

    if (!validationResult.success) {
        return validationResult;
    }

    // we don't change utcDateModified, so other changes are prioritized in case of conflict
    // also we would have to sync all those modified branches otherwise hash checks would fail
    sql.execute("UPDATE branches SET notePosition = notePosition + 10 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0",
        [afterNote.parentNoteId, afterNote.notePosition]);

    eventChangesService.putNoteReorderingEntityChange(afterNote.parentNoteId);

    const branch = new BBranch({
        noteId: noteId,
        parentNoteId: afterNote.parentNoteId,
        notePosition: afterNote.notePosition + 10,
        isExpanded: 0
    }).save();

    log.info(`Cloned note '${noteId}' into parent note '${afterNote.parentNoteId}' after note '${afterNote.noteId}', branch '${afterBranchId}'`);

    return { success: true, branchId: branch.branchId };
}

module.exports = {
    cloneNoteToBranch,
    cloneNoteToParentNote,
    ensureNoteIsPresentInParent,
    ensureNoteIsAbsentFromParent,
    toggleNoteInParent,
    cloneNoteAfter
};
