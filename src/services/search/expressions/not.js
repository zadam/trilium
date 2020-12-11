"use strict";

const Expression = require('./expression');

class NotExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, executionContext) {
        const subNoteSet = this.subExpression.execute(inputNoteSet, executionContext);

        return inputNoteSet.minus(subNoteSet);
    }
}

module.exports = NotExp;
