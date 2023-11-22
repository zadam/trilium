const treeService = require('./tree.js');
const sql = require('./sql.js');

function moveBranchToNote(branchToMove, targetParentNoteId) {
    if (branchToMove.parentNoteId === targetParentNoteId) {
        return {success: true}; // no-op
    }

    const validationResult = treeService.validateParentChild(targetParentNoteId, branchToMove.noteId, branchToMove.branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const maxNotePos = sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [targetParentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 10;

    const newBranch = branchToMove.createClone(targetParentNoteId, newNotePos);
    newBranch.save();

    branchToMove.markAsDeleted();

    return {
        success: true,
        branch: newBranch
    };
}

function moveBranchToBranch(branchToMove, targetParentBranch) {
    const res = moveBranchToNote(branchToMove, targetParentBranch.noteId);

    if (!res.success) {
        return res;
    }

    // expanding so that the new placement of the branch is immediately visible
    if (!targetParentBranch.isExpanded) {
        targetParentBranch.isExpanded = true;
        targetParentBranch.save();
    }

    return res;
}

module.exports = {
    moveBranchToBranch,
    moveBranchToNote
};
