"use strict";

class OrExp {
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
