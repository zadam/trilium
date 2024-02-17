"use strict";

import NoteSet = require('../note_set');
import SearchContext = require('../search_context');
import Expression = require('./expression');
import TrueExp = require('./true');

class AndExp extends Expression {
    private subExpressions: Expression[];

    static of(subExpressions: Expression[]) {
        subExpressions = subExpressions.filter(exp => !!exp);

        if (subExpressions.length === 1) {
            return subExpressions[0];
        } else if (subExpressions.length > 0) {
            return new AndExp(subExpressions);
        } else {
            return new TrueExp();
        }
    }

    constructor(subExpressions: Expression[]) {
        super();
        this.subExpressions = subExpressions;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        for (const subExpression of this.subExpressions) {
            inputNoteSet = subExpression.execute(inputNoteSet, executionContext, searchContext);
        }

        return inputNoteSet;
    }
}

export = AndExp;
