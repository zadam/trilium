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
    { type: 'relation', name: 'runOnNoteTitleChange' },
    { type: 'relation', name: 'runOnAttributeChange' },
    { type: 'relation', name: 'inheritAttributes' }
];

async function getNotesWithLabel(name, value) {
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

async function getNoteWithLabel(name, value) {
    const notes = await getNotesWithLabel(name, value);

    return notes.length > 0 ? notes[0] : null;
}

async function createLabel(noteId, name, value = "") {
    return await createAttribute({
        noteId: noteId,
        type: 'label',
        name: name,
        value: value
    });
}

async function createAttribute(attribute) {
    return await new Attribute(attribute).save();
}

async function getAttributeNames(type, nameLike) {
    let names;

    if (!nameLike) {
        names = BUILTIN_ATTRIBUTES
            .filter(attribute => attribute.type === type)
            .map(attribute => attribute.name);
    }
    else {
        names = await sql.getColumn(
            `SELECT DISTINCT name 
             FROM attributes 
             WHERE isDeleted = 0
               AND type = ?
               AND name LIKE '%${utils.sanitizeSql(nameLike)}%'`, [type]);
    }

    names.sort();

    return names;
}

async function removeInvalidRelations() {
    const relations = await repository.getEntities(`
      SELECT attributes.* 
      FROM attributes 
          LEFT JOIN notes AS sourceNote ON attributes.noteId = sourceNote.noteId
          LEFT JOIN notes AS targetNote ON attributes.value = targetNote.noteId
      WHERE 
          attributes.isDeleted = 0
          AND attributes.type = 'relation'
          AND (sourceNote.noteId IS NULL OR sourceNote.isDeleted
               OR targetNote.noteId IS NULL OR targetNote.isDeleted)`);

    for (const relation of relations) {
        relation.isDeleted = true;

        await relation.save();
    }
}

module.exports = {
    getNotesWithLabel,
    getNoteWithLabel,
    createLabel,
    createAttribute,
    getAttributeNames,
    removeInvalidRelations,
    BUILTIN_ATTRIBUTES
};