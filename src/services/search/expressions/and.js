"use strict";

class AndExp {
    constructor(subExpressions) {
        this.subExpressions = subExpressions;
    }

    execute(noteSet, searchContext) {
        for (const subExpression of this.subExpressions) {
            noteSet = subExpression.execute(noteSet, searchContext);
        }

        return noteSet;
    }
}

module.exports = AndExp;
