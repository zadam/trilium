const sql = require('./sql');
const utils = require('./utils');

async function addEvent(comment) {
    await addNoteEvent(null, comment);
}

async function addNoteEvent(noteId, comment) {
    await sql.insert('event_log', {
       note_id : noteId,
       comment: comment,
       date_added: utils.nowTimestamp()
    });
}

module.exports = {
    addEvent,
    addNoteEvent
};