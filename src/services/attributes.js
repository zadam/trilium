"use strict";

const repository = require('./repository');
const sql = require('./sql');
const utils = require('./utils');
const Attribute = require('../entities/attribute');

const ATTRIBUTE_TYPES = [ 'label', 'label-definition', 'relation', 'relation-definition' ];

const BUILTIN_ATTRIBUTES = [
    // label names
    { type: 'label', name: 'disableVersioning' },
    { type: 'label', name: 'calendarRoot' },
    { type: 'label', name: 'archived' },
    { type: 'label', name: 'excludeFromExport' },
    { type: 'label', name: 'manualTransactionHandling' },
    { type: 'label', name: 'disableInclusion' },
    { type: 'label', name: 'appCss' },
    { type: 'label', name: 'appTheme' },
    { type: 'label', name: 'hideChildrenOverview' },
    { type: 'label', name: 'hidePromotedAttributes' },
    { type: 'label', name: 'readOnly' },
    { type: 'label', name: 'run', isDangerous: true },
    { type: 'label', name: 'customRequestHandler', isDangerous: true },
    { type: 'label', name: 'customResourceProvider', isDangerous: true },

    // relation names
    { type: 'relation', name: 'runOnNoteView', isDangerous: true },
    { type: 'relation', name: 'runOnNoteCreation', isDangerous: true },
    { type: 'relation', name: 'runOnNoteTitleChange', isDangerous: true },
    { type: 'relation', name: 'runOnNoteChange', isDangerous: true },
    { type: 'relation', name: 'runOnChildNoteCreation', isDangerous: true },
    { type: 'relation', name: 'runOnAttributeCreation', isDangerous: true },
    { type: 'relation', name: 'runOnAttributeChange', isDangerous: true },
    { type: 'relation', name: 'template' },
    { type: 'relation', name: 'renderNote', isDangerous: true }
];

async function getNotesWithLabel(name, value) {
    let valueCondition = "";
    let params = [name];

    if (value !== undefined) {
        valueCondition = " AND attributes.value = ?";
        params.push(value);
    }

    return await repository.getEntities(`SELECT notes.* FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name = ? ${valueCondition} ORDER BY position`, params);
}

async function getNotesWithLabels(names) {
    const questionMarks = names.map(() => "?").join(", ");

    return await repository.getEntities(`SELECT notes.* FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name IN (${questionMarks}) ORDER BY position`, names);
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
    nameLike = nameLike.toLowerCase();

    const names = await sql.getColumn(
        `SELECT DISTINCT name 
             FROM attributes 
             WHERE isDeleted = 0
               AND type = ?
               AND name LIKE '%${utils.sanitizeSql(nameLike)}%'`, [type]);

    for (const attr of BUILTIN_ATTRIBUTES) {
        if (attr.type === type && attr.name.toLowerCase().includes(nameLike) && !names.includes(attr.name)) {
            names.push(attr.name);
        }
    }

    names.sort();

    return names;
}

function isAttributeType(type) {
    return ATTRIBUTE_TYPES.includes(type);
}

function isAttributeDangerous(type, name) {
    return BUILTIN_ATTRIBUTES.some(attr => 
        attr.type === attr.type && 
        attr.name.toLowerCase() === name.trim().toLowerCase() &&
        attr.isDangerous
    );
}

module.exports = {
    getNotesWithLabel,
    getNotesWithLabels,
    getNoteWithLabel,
    createLabel,
    createAttribute,
    getAttributeNames,
    isAttributeType,
    isAttributeDangerous
};