"use strict";

const repository = require('./repository');
const sql = require('./sql');
const utils = require('./utils');
const Attribute = require('../entities/attribute');

const ATTRIBUTE_TYPES = [ 'label', 'relation' ];

const BUILTIN_ATTRIBUTES = [
    // label names
    { type: 'label', name: 'disableVersioning' },
    { type: 'label', name: 'calendarRoot' },
    { type: 'label', name: 'archived' },
    { type: 'label', name: 'excludeFromExport' },
    { type: 'label', name: 'disableInclusion' },
    { type: 'label', name: 'appCss' },
    { type: 'label', name: 'appTheme' },
    { type: 'label', name: 'hidePromotedAttributes' },
    { type: 'label', name: 'readOnly' },
    { type: 'label', name: 'autoReadOnlyDisabled' },
    { type: 'label', name: 'cssClass' },
    { type: 'label', name: 'iconClass' },
    { type: 'label', name: 'keyboardShortcut' },
    { type: 'label', name: 'run', isDangerous: true },
    { type: 'label', name: 'customRequestHandler', isDangerous: true },
    { type: 'label', name: 'customResourceProvider', isDangerous: true },
    { type: 'label', name: 'bookZoomLevel', isDangerous: false },
    { type: 'label', name: 'widget', isDangerous: true },
    { type: 'label', name: 'noteInfoWidgetDisabled' },
    { type: 'label', name: 'linkMapWidgetDisabled' },
    { type: 'label', name: 'noteRevisionsWidgetDisabled' },
    { type: 'label', name: 'whatLinksHereWidgetDisabled' },
    { type: 'label', name: 'similarNotesWidgetDisabled' },

    // relation names
    { type: 'relation', name: 'runOnNoteCreation', isDangerous: true },
    { type: 'relation', name: 'runOnNoteTitleChange', isDangerous: true },
    { type: 'relation', name: 'runOnNoteChange', isDangerous: true },
    { type: 'relation', name: 'runOnChildNoteCreation', isDangerous: true },
    { type: 'relation', name: 'runOnAttributeCreation', isDangerous: true },
    { type: 'relation', name: 'runOnAttributeChange', isDangerous: true },
    { type: 'relation', name: 'template' },
    { type: 'relation', name: 'widget', isDangerous: true },
    { type: 'relation', name: 'renderNote', isDangerous: true }
];

function getNotesWithLabel(name, value) {
    let valueCondition = "";
    let params = [name];

    if (value !== undefined) {
        valueCondition = " AND attributes.value = ?";
        params.push(value);
    }

    return repository.getEntities(`SELECT notes.* FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name = ? ${valueCondition} ORDER BY position`, params);
}

function getNotesWithLabels(names) {
    const questionMarks = names.map(() => "?").join(", ");

    return repository.getEntities(`SELECT notes.* FROM notes JOIN attributes USING(noteId) 
          WHERE notes.isDeleted = 0 AND attributes.isDeleted = 0 AND attributes.name IN (${questionMarks}) ORDER BY position`, names);
}

function getNoteWithLabel(name, value) {
    const notes = getNotesWithLabel(name, value);

    return notes.length > 0 ? notes[0] : null;
}

function createLabel(noteId, name, value = "") {
    return createAttribute({
        noteId: noteId,
        type: 'label',
        name: name,
        value: value
    });
}

function createRelation(noteId, name, targetNoteId) {
    return createAttribute({
        noteId: noteId,
        type: 'relation',
        name: name,
        value: targetNoteId
    });
}

function createAttribute(attribute) {
    return new Attribute(attribute).save();
}

function getAttributeNames(type, nameLike) {
    nameLike = nameLike.toLowerCase();

    const names = sql.getColumn(
        `SELECT DISTINCT name 
             FROM attributes 
             WHERE isDeleted = 0
               AND type = ?
               AND name LIKE ?`, [type, '%' + nameLike + '%']);

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

function getBuiltinAttributeNames() {
    return BUILTIN_ATTRIBUTES
        .map(attr => attr.name)
        .concat([
            'internalLink',
            'imageLink',
            'includeNoteLink',
            'relationMapLink'
        ]);
}

module.exports = {
    getNotesWithLabel,
    getNotesWithLabels,
    getNoteWithLabel,
    createLabel,
    createRelation,
    createAttribute,
    getAttributeNames,
    isAttributeType,
    isAttributeDangerous,
    getBuiltinAttributeNames
};
