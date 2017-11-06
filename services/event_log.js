const sql = require('./sql');
const utils = require('./utils');
const log = require('./log');

async function addEvent(comment) {
    await addNoteEvent(null, comment);
}

async function addNoteEvent(noteId, comment) {
    await sql.insert('event_log', {
       note_id : noteId,
       comment: comment,
       date_added: utils.nowTimestamp()
    });

    log.info("Event log for " + noteId + ": " + comment);
}

module.exports = {
    addEvent,
    addNoteEvent
};