"use strict";

const repository = require('./repository');
const Label = require('../entities/label');

const BUILTIN_LABELS = [
    'disableVersioning',
    'calendarRoot',
    'hideInAutocomplete',
    'excludeFromExport',
    'run',
    'manualTransactionHandling',
    'disableInclusion',
    'appCss'
];

async function getNotesWithLabel(name, value) {
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

async function getNoteWithLabel(name, value) {
    const notes = await getNotesWithLabel(name, value);

    return notes.length > 0 ? notes[0] : null;
}

async function createLabel(noteId, name, value = "") {
    return await new Label({
        noteId: noteId,
        name: name,
        value: value
    }).save();
}

module.exports = {
    getNotesWithLabel,
    getNoteWithLabel,
    createLabel,
    BUILTIN_LABELS
};