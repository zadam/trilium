"use strict";

class AndExp {
    constructor(subExpressions) {
        this.subExpressions = subExpressions;
    }

    static of(subExpressions) {
        if (subExpressions.length === 1) {
            return subExpressions[0];
        }
        else {
            return new AndExp(subExpressions);
        }
    }

    execute(noteSet, searchContext) {
        for (const subExpression of this.subExpressions) {
            noteSet = subExpression.execute(noteSet, searchContext);
        }

        return noteSet;
    }
}

module.exports = AndExp;
