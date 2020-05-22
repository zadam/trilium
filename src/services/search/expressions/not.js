"use strict";

const Expression = require('./expression');

class NotExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(noteSet, searchContext) {
        const subNoteSet = this.subExpression.execute(noteSet, searchContext);

        return noteSet.minus(subNoteSet);
    }
}

module.exports = NotExp;
