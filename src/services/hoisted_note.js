const cls = require('./cls.js');
const becca = require('../becca/becca.js');

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
        throw new Error(`Cannot find hoisted note '${hoistedNoteId}'`);
    }

    return hoistedNote.isHiddenCompletely();
}

function getWorkspaceNote() {
    const hoistedNote = becca.getNote(cls.getHoistedNoteId());

    if (hoistedNote.isRoot() || hoistedNote.hasLabel('workspace')) {
        return hoistedNote;
    } else {
        return becca.getRoot();
    }
}

module.exports = {
    getHoistedNoteId,
    getWorkspaceNote,
    isHoistedInHiddenSubtree
};
