"use strict";

import Expression from './expression.js'

class TrueExp extends Expression {
    execute(inputNoteSet, executionContext, searchContext) {
        return inputNoteSet;
    }
}

export default TrueExp;
