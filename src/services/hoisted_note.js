const cls = require("./cls");
const becca = require("../becca/becca");

function getHoistedNoteId() {
    return cls.getHoistedNoteId();
}

function isHoistedInHiddenSubtree() {
    const hoistedNoteId = getHoistedNoteId();

    if (hoistedNoteId === 'root') {
        return false;
    } else if (hoistedNoteId === '_hidden') {
        return true;
    }

    const hoistedNote = becca.getNote(hoistedNoteId);

    if (!hoistedNote) {
        throw new Error(`Cannot find hoisted note ${hoistedNoteId}`);
    }

    return hoistedNote.hasAncestor('_hidden');
}

function getHoistedNote() {
    return becca.getNote(cls.getHoistedNoteId());
}

function getWorkspaceNote() {
    const hoistedNote = getHoistedNote();

    if (hoistedNote.isRoot() || hoistedNote.hasLabel('workspace')) {
        return hoistedNote;
    } else {
        return becca.getRoot();
    }
}

module.exports = {
    getHoistedNoteId,
    getHoistedNote,
    getWorkspaceNote,
    isHoistedInHiddenSubtree
};
