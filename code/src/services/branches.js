const treeService = require("./tree");
const sql = require("./sql");

function moveBranchToNote(sourceBranch, targetParentNoteId) {
    if (sourceBranch.parentNoteId === targetParentNoteId) {
        return {success: true}; // no-op
    }

    const validationResult = treeService.validateParentChild(targetParentNoteId, sourceBranch.noteId, sourceBranch.branchId);

    if (!validationResult.success) {
        return [200, validationResult];
    }

    const maxNotePos = sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [targetParentNoteId]);
    const newNotePos = maxNotePos === null ? 0 : maxNotePos + 10;

    const newBranch = sourceBranch.createClone(targetParentNoteId, newNotePos);
    newBranch.save();

    sourceBranch.markAsDeleted();

    return {
        success: true,
        branch: newBranch
    };
}

function moveBranchToBranch(sourceBranch, targetParentBranch) {
    const res = moveBranchToNote(sourceBranch, targetParentBranch.noteId);

    if (!res.success) {
        return res;
    }

    // expanding so that the new placement of the branch is immediately visible
    targetParentBranch.isExpanded = true;
    targetParentBranch.save();

    return res;
}

module.exports = {
    moveBranchToBranch,
    moveBranchToNote
};
