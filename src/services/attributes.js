"use strict";

const repository = require('./repository');
const Attribute = require('../entities/attribute');

const BUILTIN_ATTRIBUTES = [
    'disableVersioning',
    'calendarRoot',
    'archived',
    'excludeFromExport',
    'run',
    'manualTransactionHandling',
    'disableInclusion',
    'appCss',
    'hideChildrenOverview'
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

module.exports = {
    getNotesWithAttribute,
    getNoteWithAttribute,
    createAttribute,
    BUILTIN_ATTRIBUTES
};