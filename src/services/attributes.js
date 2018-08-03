"use strict";

const repository = require('./repository');
const sql = require('./sql');
const utils = require('./utils');
const Attribute = require('../entities/attribute');

const BUILTIN_ATTRIBUTES = [
    // label names
    { type: 'label', name: 'disableVersioning' },
    { type: 'label', name: 'calendarRoot' },
    { type: 'label', name: 'archived' },
    { type: 'label', name: 'excludeFromExport' },
    { type: 'label', name: 'run' },
    { type: 'label', name: 'manualTransactionHandling' },
    { type: 'label', name: 'disableInclusion' },
    { type: 'label', name: 'appCss' },
    { type: 'label', name: 'hideChildrenOverview' },

    // relation names
    { type: 'relation', name: 'runOnNoteView' },
    { type: 'relation', name: 'runOnNoteTitleChange' }
];

async function getNotesWithAttribute(name, value) {
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

async function getNoteWithAttribute(name, value) {
    const notes = await getNotesWithAttribute(name, value);

    return notes.length > 0 ? notes[0] : null;
}

async function createAttribute(noteId, name, value = "") {
    return await new Attribute({
        noteId: noteId,
        name: name,
        value: value
    }).save();
}

async function getAttributeNames(type, nameLike) {
    const names = await sql.getColumn(
        `SELECT DISTINCT name 
         FROM attributes 
         WHERE isDeleted = 0
           AND type = ?
           AND name LIKE '%${utils.sanitizeSql(nameLike)}%'`, [ type ]);

    for (const attribute of BUILTIN_ATTRIBUTES) {
        if (attribute.type === type && !names.includes(attribute.name)) {
            names.push(attribute.name);
        }
    }

    names.sort();

    return names;
}

module.exports = {
    getNotesWithAttribute,
    getNoteWithAttribute,
    createAttribute,
    getAttributeNames,
    BUILTIN_ATTRIBUTES
};