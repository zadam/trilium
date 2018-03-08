"use strict";

const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');

const BUILTIN_ATTRIBUTES = [
    'frontend_startup',
    'backend_startup',
    'disable_versioning',
    'calendar_root',
    'hide_in_autocomplete',
    'exclude_from_export',
    'run',
    'manual_transaction_handling',
    'disable_inclusion',
    'app_css'
];

async function getNoteAttributeMap(noteId) {
    return await sql.getMap(`SELECT name, value FROM attributes WHERE noteId = ? AND isDeleted = 0`, [noteId]);
}

async function getNoteIdWithAttribute(name, value) {
    return await sql.getValue(`SELECT notes.noteId FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0
                AND attributes.isDeleted = 0
                AND attributes.name = ? 
                AND attributes.value = ?`, [name, value]);
}

async function getNotesWithAttribute(repository, name, value) {
    let notes;

    if (value !== undefined) {
        notes = await repository.getEntities(`SELECT notes.* FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name = ? AND attributes.value = ?`, [name, value]);
    }
    else {
        notes = await repository.getEntities(`SELECT notes.* FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name = ?`, [name]);
    }

    return notes;
}

async function getNoteWithAttribute(repository, name, value) {
    const notes = getNotesWithAttribute(repository, name, value);

    return notes.length > 0 ? notes[0] : null;
}

async function getNoteIdsWithAttribute(name) {
    return await sql.getColumn(`SELECT DISTINCT notes.noteId FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name = ? AND attributes.isDeleted = 0`, [name]);
}

async function createAttribute(noteId, name, value = "", sourceId = null) {
    if (value === null || value === undefined) {
        value = "";
    }

    const now = utils.nowDate();
    const attributeId = utils.newAttributeId();
    const position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM attributes WHERE noteId = ?`, [noteId]);

    await sql.insert("attributes", {
        attributeId: attributeId,
        noteId: noteId,
        name: name,
        value: value,
        position: position,
        dateModified: now,
        dateCreated: now,
        isDeleted: false
    });

    await sync_table.addAttributeSync(attributeId, sourceId);
}

module.exports = {
    getNoteAttributeMap,
    getNoteIdWithAttribute,
    getNotesWithAttribute,
    getNoteWithAttribute,
    getNoteIdsWithAttribute,
    createAttribute,
    BUILTIN_ATTRIBUTES
};