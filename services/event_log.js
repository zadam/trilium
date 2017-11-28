const sql = require('./sql');
const utils = require('./utils');
const log = require('./log');

async function addEvent(db, comment) {
    await addNoteEvent(db, null, comment);
}

async function addNoteEvent(db, noteId, comment) {
    await sql.insert(db, 'event_log', {
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