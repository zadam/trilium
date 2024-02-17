"use strict";

import NoteSet = require('../note_set');
import SearchContext = require('../search_context');
import Expression = require('./expression');

class NotExp extends Expression {
    private subExpression: Expression;

    constructor(subExpression: Expression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const subNoteSet = this.subExpression.execute(inputNoteSet, executionContext, searchContext);

        return inputNoteSet.minus(subNoteSet);
    }
}

export = NotExp;
