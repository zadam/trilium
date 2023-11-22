"use strict";

const Expression = require('./expression.js');
const NoteSet = require('../note_set.js');
const TrueExp = require('./true.js');

class OrExp extends Expression {
    static of(subExpressions) {
        subExpressions = subExpressions.filter(exp => !!exp);

        if (subExpressions.length === 1) {
            return subExpressions[0];
        }
        else if (subExpressions.length > 0) {
            return new OrExp(subExpressions);
        }
        else {
            return new TrueExp();
        }
    }

    constructor(subExpressions) {
        super();

        this.subExpressions = subExpressions;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        const resultNoteSet = new NoteSet();

        for (const subExpression of this.subExpressions) {
            resultNoteSet.mergeIn(subExpression.execute(inputNoteSet, executionContext, searchContext));
        }

        return resultNoteSet;
    }
}

module.exports = OrExp;
