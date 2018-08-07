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

async function getEffectiveAttributes(noteId) {
    const attributes = await repository.getEntities(`
        WITH RECURSIVE tree(noteId, level) AS (
        SELECT ?, 0
            UNION
            SELECT branches.parentNoteId, tree.level + 1 FROM branches
            JOIN tree ON branches.noteId = tree.noteId
            JOIN notes ON notes.noteId = branches.parentNoteId
            WHERE notes.isDeleted = 0 AND branches.isDeleted = 0
        )
        SELECT attributes.* FROM attributes JOIN tree ON attributes.noteId = tree.noteId 
        WHERE attributes.isDeleted = 0 AND (attributes.isInheritable = 1 OR attributes.noteId = ?)
        ORDER BY level, noteId, position`, [noteId, noteId]);
    // attributes are ordered so that "closest" attributes are first
    // we order by noteId so that attributes from same note stay together. Actual noteId ordering doesn't matter.

    const filteredAttributes = attributes.filter((attr, index) => {
        if (attr.isDefinition()) {
            const firstDefinitionIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

            // keep only if this element is the first definition for this type & name
            return firstDefinitionIndex === index;
        }
        else {
            const definitionAttr = attributes.find(el => el.type === attr.type + '-definition' && el.name === attr.name);

            if (!definitionAttr) {
                return true;
            }

            const definition = definitionAttr.value;

            if (definition.multiplicityType === 'multivalue') {
                return true;
            }
            else {
                const firstAttrIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

                // in case of single-valued attribute we'll keep it only if it's first (closest)
                return firstAttrIndex === index;
            }
        }
    });

    for (const attr of filteredAttributes) {
        attr.isOwned = attr.noteId === noteId;
    }

    return filteredAttributes;
}

module.exports = {
    getNotesWithLabel,
    getNoteWithLabel,
    createAttribute,
    getAttributeNames,
    getEffectiveAttributes,
    BUILTIN_ATTRIBUTES
};