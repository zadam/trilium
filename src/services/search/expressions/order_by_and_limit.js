"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');

class OrderByAndLimitExp extends Expression {
    constructor(orderDefinitions, limit) {
        super();

        this.orderDefinitions = orderDefinitions;

        for (const od of this.orderDefinitions) {
            od.smaller = od.direction === "asc" ? -1 : 1;
            od.larger = od.direction === "asc" ? 1 : -1;
        }

        this.limit = limit;

        /** @type {Expression} */
        this.subExpression = null; // it's expected to be set after construction
    }

    execute(inputNoteSet, executionContext) {
        let {notes} = this.subExpression.execute(inputNoteSet, executionContext);

        notes.sort((a, b) => {
            for (const {valueExtractor, smaller, larger} of this.orderDefinitions) {
                let valA = valueExtractor.extract(a);
                let valB = valueExtractor.extract(b);

                if (!isNaN(valA) && !isNaN(valB)) {
                    valA = parseFloat(valA);
                    valB = parseFloat(valB);
                }

                if (valA < valB) {
                    return smaller;
                } else if (valA > valB) {
                    return larger;
                }
                // else go to next order definition
            }

            return 0;
        });

        if (this.limit >= 0) {
            notes = notes.slice(0, this.limit);
        }

        const noteSet = new NoteSet(notes);
        noteSet.sorted = true;

        return noteSet;
    }
}

module.exports = OrderByAndLimitExp;
