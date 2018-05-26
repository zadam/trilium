const sql = require('./sql');
const dateUtils = require('./date_utils');
const log = require('./log');

async function addEvent(comment) {
    await addNoteEvent(null, comment);
}

async function addNoteEvent(noteId, comment) {
    await sql.insert('event_log', {
       noteId : noteId,
       comment: comment,
       dateCreated: dateUtils.nowDate()
    });

    log.info("Event log for " + noteId + ": " + comment);
}

module.exports = {
    addEvent,
    addNoteEvent
};