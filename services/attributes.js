"use strict";

const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');
const protected_session = require('./protected_session');

async function getNoteAttributeMap(noteId) {
    return await sql.getMap(`SELECT name, value FROM attributes WHERE note_id = ?`, [noteId]);
}

async function getNoteIdWithAttribute(name, value) {
    return await sql.getFirstValue(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
          WHERE notes.is_deleted = 0 AND attributes.name = ? AND attributes.value = ?`, [name, value]);
}

async function getNoteWithAttribute(dataKey, name, value) {
    const note = await sql.getFirst(`SELECT notes.* FROM notes JOIN attributes USING(note_id) 
          WHERE notes.is_deleted = 0 AND attributes.name = ? AND attributes.value = ?`, [name, value]);

    if (!note) {
        return note;
    }

    protected_session.decryptNote(dataKey, note);

    return note;
}

async function getNoteIdsWithAttribute(name) {
    return await sql.getFirstColumn(`SELECT DISTINCT notes.note_id FROM notes JOIN attributes USING(note_id) 
          WHERE notes.is_deleted = 0 AND attributes.name = ?`, [name]);
}

async function createAttribute(noteId, name, value = null, sourceId = null) {
    const now = utils.nowDate();
    const attributeId = utils.newAttributeId();

    await sql.insert("attributes", {
        attribute_id: attributeId,
        note_id: noteId,
        name: name,
        value: value,
        date_modified: now,
        date_created: now
    });

    await sync_table.addAttributeSync(attributeId, sourceId);
}

module.exports = {
    getNoteAttributeMap,
    getNoteIdWithAttribute,
    getNoteWithAttribute,
    getNoteIdsWithAttribute,
    createAttribute
};