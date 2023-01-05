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

        this.limit = limit || 0;

        /** @type {Expression} */
        this.subExpression = null; // it's expected to be set after construction
    }

    execute(inputNoteSet, executionContext, searchContext) {
        let {notes} = this.subExpression.execute(inputNoteSet, executionContext, searchContext);

        notes.sort((a, b) => {
            for (const {valueExtractor, smaller, larger} of this.orderDefinitions) {
                let valA = valueExtractor.extract(a);
                let valB = valueExtractor.extract(b);

                if (valA === undefined) {
                    valA = null;
                }

                if (valB === undefined) {
                    valB = null;
                }

                if (valA === null && valB === null) {
                    // neither has attribute at all
                    continue;
                }
                else if (valB === null) {
                    return smaller;
                }
                else if (valA === null) {
                    return larger;
                }

                // if both are numbers then parse them for numerical comparison
                if (this.isNumber(valA) && this.isNumber(valB)) {
                    valA = parseFloat(valA);
                    valB = parseFloat(valB);
                }

                if (!valA && !valB) {
                    // the attribute value is empty/zero in both notes so continue to the next order definition
                    continue;
                } else if (!valB || valA < valB) {
                    return smaller;
                } else if (!valA || valA > valB) {
                    return larger;
                }
                // else the values are equal and continue to next order definition
            }

            return 0;
        });

        if (this.limit > 0) {
            notes = notes.slice(0, this.limit);
        }

        const noteSet = new NoteSet(notes);
        noteSet.sorted = true;

        return noteSet;
    }

    isNumber(x) {
        if (typeof x === 'number') {
            return true;
        } else if (typeof x === 'string') {
            // isNaN will return false for blank string
            return x.trim() !== "" && !isNaN(x);
        } else {
            return false;
        }
    }
}

module.exports = OrderByAndLimitExp;
