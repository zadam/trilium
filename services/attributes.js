const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');

async function getNoteIdWithAttribute(name, value) {
    return await sql.getFirstValue(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
          WHERE notes.is_deleted = 0 AND attributes.name = ? AND attributes.value = ?`, [name, value]);
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
    getNoteIdWithAttribute,
    createAttribute
};