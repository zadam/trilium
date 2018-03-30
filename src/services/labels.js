"use strict";

const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');

const BUILTIN_LABELS = [
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

async function getNoteLabelMap(noteId) {
    return await sql.getMap(`SELECT name, value FROM labels WHERE noteId = ? AND isDeleted = 0`, [noteId]);
}

async function getNoteIdWithLabel(name, value) {
    return await sql.getValue(`SELECT notes.noteId FROM notes JOIN labels USING(noteId) 
          WHERE notes.isDeleted = 0
                AND labels.isDeleted = 0
                AND labels.name = ? 
                AND labels.value = ?`, [name, value]);
}

async function getNotesWithLabel(repository, name, value) {
    let notes;

    if (value !== undefined) {
        notes = await repository.getEntities(`SELECT notes.* FROM notes JOIN labels USING(noteId) 
          WHERE notes.isDeleted = 0 AND labels.isDeleted = 0 AND labels.name = ? AND labels.value = ?`, [name, value]);
    }
    else {
        notes = await repository.getEntities(`SELECT notes.* FROM notes JOIN labels USING(noteId) 
          WHERE notes.isDeleted = 0 AND labels.isDeleted = 0 AND labels.name = ?`, [name]);
    }

    return notes;
}

async function getNoteWithLabel(repository, name, value) {
    const notes = getNotesWithLabel(repository, name, value);

    return notes.length > 0 ? notes[0] : null;
}

async function getNoteIdsWithLabel(name) {
    return await sql.getColumn(`SELECT DISTINCT notes.noteId FROM notes JOIN labels USING(noteId) 
          WHERE notes.isDeleted = 0 AND labels.isDeleted = 0 AND labels.name = ? AND labels.isDeleted = 0`, [name]);
}

async function createLabel(noteId, name, value = "") {
    if (value === null || value === undefined) {
        value = "";
    }

    const now = utils.nowDate();
    const labelId = utils.newLabelId();
    const position = 1 + await sql.getValue(`SELECT COALESCE(MAX(position), 0) FROM labels WHERE noteId = ?`, [noteId]);

    await sql.insert("labels", {
        labelId: labelId,
        noteId: noteId,
        name: name,
        value: value,
        position: position,
        dateModified: now,
        dateCreated: now,
        isDeleted: false
    });

    await sync_table.addLabelSync(labelId);
}

module.exports = {
    getNoteLabelMap,
    getNoteIdWithLabel,
    getNotesWithLabel,
    getNoteWithLabel,
    getNoteIdsWithLabel,
    createLabel,
    BUILTIN_LABELS
};