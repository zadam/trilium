"use strict";

const NoteSet = require('../note_set');

class OrExp {
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
        this.subExpressions = subExpressions;
    }

    execute(noteSet, searchContext) {
        const resultNoteSet = new NoteSet();

        for (const subExpression of this.subExpressions) {
            resultNoteSet.mergeIn(subExpression.execute(noteSet, searchContext));
        }

        return resultNoteSet;
    }
}

module.exports = OrExp;
