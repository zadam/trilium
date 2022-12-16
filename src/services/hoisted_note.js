const cls = require("./cls");
const becca = require("../becca/becca");

function getHoistedNoteId() {
    return cls.getHoistedNoteId();
}

function isHoistedInHiddenSubtree() {
    const hoistedNoteId = getHoistedNoteId();

    if (hoistedNoteId === 'root') {
        return false;
    } else if (hoistedNoteId === 'hidden') {
        return true;
    }

    const hoistedNote = becca.getNote(hoistedNoteId);

    if (!hoistedNote) {
        throw new Error(`Cannot find hoisted note ${hoistedNoteId}`);
    }

    return hoistedNote.hasAncestor('hidden');
}

module.exports = {
    getHoistedNoteId,
    isHoistedInHiddenSubtree
};
