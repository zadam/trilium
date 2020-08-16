"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');

/**
 * Search string is lower cased for case insensitive comparison. But when retrieving properties
 * we need case sensitive form so we have this translation object.
 */
const PROP_MAPPING = {
    "noteid": "noteId",
    "title": "title",
    "type": "type",
    "mime": "mime",
    "isprotected": "isProtected",
    "isarhived": "isArchived",
    "datecreated": "dateCreated",
    "datemodified": "dateModified",
    "utcdatecreated": "utcDateCreated",
    "utcdatemodified": "utcDateModified",
    "parentcount": "parentCount",
    "childrencount": "childrenCount",
    "attributecount": "attributeCount",
    "labelcount": "labelCount",
    "relationcount": "relationCount"
};

class PropertyComparisonExp extends Expression {
    static isProperty(name) {
        return name in PROP_MAPPING;
    }

    constructor(propertyName, comparator) {
        super();

        this.propertyName = PROP_MAPPING[propertyName];
        this.comparator = comparator;
    }

    execute(inputNoteSet, searchContext) {
        const resNoteSet = new NoteSet();

        for (const note of inputNoteSet.notes) {
            let value = note[this.propertyName];

            if (value !== undefined && value !== null && typeof value !== 'string') {
                value = value.toString();
            }

            if (value) {
                value = value.toLowerCase();
            }

            if (this.comparator(value)) {
                resNoteSet.add(note);
            }
        }

        return resNoteSet;
    }
}

module.exports = PropertyComparisonExp;
