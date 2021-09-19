"use strict";

const Expression = require('./expression');
const TrueExp = require("./true.js");

class AndExp extends Expression {
    static of(subExpressions) {
        subExpressions = subExpressions.filter(exp => !!exp);

        if (subExpressions.length === 1) {
            return subExpressions[0];
        } else if (subExpressions.length > 0) {
            return new AndExp(subExpressions);
        } else {
            return new TrueExp();
        }
    }

    constructor(subExpressions) {
        super();
        this.subExpressions = subExpressions;
    }

    execute(inputNoteSet, executionContext) {
        for (const subExpression of this.subExpressions) {
            inputNoteSet = subExpression.execute(inputNoteSet, executionContext);
        }

        return inputNoteSet;
    }
}

module.exports = AndExp;
