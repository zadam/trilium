const becca = require("../../becca/becca");
const bulkActionService = require("../../services/bulk_actions");

function execute(req) {
    const {noteIds, includeDescendants} = req.body;

    const affectedNoteIds = getAffectedNoteIds(noteIds, includeDescendants);

    const bulkActionNote = becca.getNote('bulkaction');

    bulkActionService.executeActions(bulkActionNote, affectedNoteIds);
}

function getAffectedNoteCount(req) {
    const {noteIds, includeDescendants} = req.body;

    const affectedNoteIds = getAffectedNoteIds(noteIds, includeDescendants);

    return {
        affectedNoteCount: affectedNoteIds.size
    };
}

function getAffectedNoteIds(noteIds, includeDescendants) {
    const affectedNoteIds = new Set();

    for (const noteId of noteIds) {
        const note = becca.getNote(noteId);

        if (!note) {
            continue;
        }

        affectedNoteIds.add(noteId);

        if (includeDescendants) {
            for (const descendantNoteId of note.getDescendantNoteIds()) {
                affectedNoteIds.add(descendantNoteId);
            }
        }
    }
    return affectedNoteIds;
}

module.exports = {
    execute,
    getAffectedNoteCount
};
