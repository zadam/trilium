let hoistedNoteId = 'root';

module.exports = {
    getHoistedNoteId: () => hoistedNoteId,
    setHoistedNoteId(noteId) { hoistedNoteId = noteId; }
};
