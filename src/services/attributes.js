"use strict";

const searchService = require('./search/services/search');
const sql = require('./sql');
const becca = require('../becca/becca');
const BAttribute = require('../becca/entities/battribute');
const {formatAttrForSearch} = require("./attribute_formatter");
const BUILTIN_ATTRIBUTES = require("./builtin_attributes");

const ATTRIBUTE_TYPES = [ 'label', 'relation' ];

/** @returns {BNote[]} */
function getNotesWithLabel(name, value = undefined) {
    const query = formatAttrForSearch({type: 'label', name, value}, value !== undefined);
    return searchService.searchNotes(query, {
        includeArchivedNotes: true,
        ignoreHoistedNote: true
    });
}

// TODO: should be in search service
/** @returns {BNote|null} */
function getNoteWithLabel(name, value = undefined) {
    // optimized version (~20 times faster) without using normal search, useful for e.g. finding date notes
    const attrs = becca.findAttributes('label', name);

    if (value === undefined) {
        return attrs[0]?.getNote();
    }

    value = value?.toLowerCase();

    for (const attr of attrs) {
        if (attr.value.toLowerCase() === value) {
            return attr.getNote();
        }
    }

    return null;
}

/**
 * Does not take into account templates and inheritance
 */
function getNotesWithLabelFast(name, value) {
    // optimized version (~20 times faster) without using normal search, useful for e.g. finding date notes
    const attrs = becca.findAttributes('label', name);

    if (value === undefined) {
        return attrs.map(attr => attr.getNote());
    }

    value = value?.toLowerCase();

    return attrs
        .filter(attr => attr.value.toLowerCase() === value)
        .map(attr => attr.getNote());
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
    return new BAttribute(attribute).save();
}

function getAttributeNames(type, nameLike) {
    nameLike = nameLike.toLowerCase();

    let names = sql.getColumn(
        `SELECT DISTINCT name 
             FROM attributes 
             WHERE isDeleted = 0
               AND type = ?
               AND name LIKE ?`, [type, `%${nameLike}%`]);

    for (const attr of BUILTIN_ATTRIBUTES) {
        if (attr.type === type && attr.name.toLowerCase().includes(nameLike) && !names.includes(attr.name)) {
            names.push(attr.name);
        }
    }

    names = names.filter(name => ![
        'internalLink',
        'imageLink',
        'includeNoteLink',
        'relationMapLink'
    ].includes(name));

    names.sort((a, b) => {
        const aPrefix = a.toLowerCase().startsWith(nameLike);
        const bPrefix = b.toLowerCase().startsWith(nameLike);

        if (aPrefix !== bPrefix) {
            return aPrefix ? -1 : 1;
        }

        return a < b ? -1 : 1;
    });

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
    getNotesWithLabelFast,
    getNoteWithLabel,
    createLabel,
    createRelation,
    createAttribute,
    getAttributeNames,
    isAttributeType,
    isAttributeDangerous
};
