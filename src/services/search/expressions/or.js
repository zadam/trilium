"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');

class OrExp extends Expression {
    static of(subExpressions) {
        subExpressions = subExpressions.filter(exp => !!exp);

        if (subExpressions.length === 1) {
            return subExpressions[0];
        }
        else if (subExpressions.length > 0) {
            return new OrExp(subExpressions);
        }
    }

    constructor(subExpressions) {
        super();

        this.subExpressions = subExpressions;
    }

    execute(inputNoteSet, searchContext) {
        const resultNoteSet = new NoteSet();

        for (const subExpression of this.subExpressions) {
            resultNoteSet.mergeIn(subExpression.execute(inputNoteSet, searchContext));
        }

        return resultNoteSet;
    }
}

module.exports = OrExp;
