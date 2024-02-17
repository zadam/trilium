"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import TrueExp = require('./true');
import SearchContext = require('../search_context');

class OrExp extends Expression {
    private subExpressions: Expression[];

    static of(subExpressions: Expression[]) {
        subExpressions = subExpressions.filter(exp => !!exp);

        if (subExpressions.length === 1) {
            return subExpressions[0];
        }
        else if (subExpressions.length > 0) {
            return new OrExp(subExpressions);
        }
        else {
            return new TrueExp();
        }
    }

    constructor(subExpressions: Expression[]) {
        super();

        this.subExpressions = subExpressions;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const resultNoteSet = new NoteSet();

        for (const subExpression of this.subExpressions) {
            resultNoteSet.mergeIn(subExpression.execute(inputNoteSet, executionContext, searchContext));
        }

        return resultNoteSet;
    }
}

export = OrExp;
