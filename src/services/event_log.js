const sql = require('./sql');
const dateUtils = require('./date_utils');
const utils = require('./utils');
const log = require('./log');

async function addEvent(comment) {
    await addNoteEvent(null, comment);
}

async function addNoteEvent(noteId, comment) {
    await sql.insert('event_log', {
        eventId: utils.newEntityId(),
        noteId : noteId,
        comment: comment,
        utcDateCreated: dateUtils.utcNowDateTime()
    });

    log.info("Event log for " + noteId + ": " + comment);
}

module.exports = {
    addEvent
};