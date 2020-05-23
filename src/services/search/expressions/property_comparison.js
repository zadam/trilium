"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');

class PropertyComparisonExp extends Expression {
    constructor(propertyName, comparator) {
        super();

        this.propertyName = propertyName;
        this.comparator = comparator;
    }

    execute(noteSet, searchContext) {
        const resNoteSet = new NoteSet();

        for (const note of noteSet.notes) {
            const value = note[this.propertyName].toLowerCase();

            if (this.comparator(value)) {
                resNoteSet.add(note);
            }
        }

        return resNoteSet;
    }
}

module.exports = PropertyComparisonExp;
