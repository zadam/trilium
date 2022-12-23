"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const buildComparator = require("../services/build_comparator");

/**
 * Search string is lower cased for case-insensitive comparison. But when retrieving properties
 * we need case-sensitive form, so we have this translation object.
 */
const PROP_MAPPING = {
    "noteid": "noteId",
    "title": "title",
    "type": "type",
    "mime": "mime",
    "isprotected": "isProtected",
    "isarchived": "isArchived",
    "datecreated": "dateCreated",
    "datemodified": "dateModified",
    "utcdatecreated": "utcDateCreated",
    "utcdatemodified": "utcDateModified",
    "parentcount": "parentCount",
    "childrencount": "childrenCount",
    "attributecount": "attributeCount",
    "labelcount": "labelCount",
    "ownedlabelcount": "ownedLabelCount",
    "relationcount": "relationCount",
    "ownedrelationcount": "ownedRelationCount",
    "relationcountincludinglinks": "relationCountIncludingLinks",
    "ownedrelationcountincludinglinks": "ownedRelationCountIncludingLinks",
    "targetrelationcount": "targetRelationCount",
    "targetrelationcountincludinglinks": "targetRelationCountIncludingLinks",
    "contentsize": "contentSize",
    "notesize": "noteSize",
    "revisioncount": "revisionCount"
};

class PropertyComparisonExp extends Expression {
    static isProperty(name) {
        return name in PROP_MAPPING;
    }

    constructor(searchContext, propertyName, operator, comparedValue) {
        super();

        this.propertyName = PROP_MAPPING[propertyName];
        this.operator = operator; // for DEBUG mode
        this.comparedValue = comparedValue; // for DEBUG mode
        this.comparator = buildComparator(operator, comparedValue);

        if (['contentsize', 'notesize', 'revisioncount'].includes(this.propertyName)) {
            searchContext.dbLoadNeeded = true;
        }
    }

    execute(inputNoteSet, executionContext, searchContext) {
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
