"use strict";

import Expression from './expression.js'

class NotExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        const subNoteSet = this.subExpression.execute(inputNoteSet, executionContext, searchContext);

        return inputNoteSet.minus(subNoteSet);
    }
}

export default NotExp;
