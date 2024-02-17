"use strict";

const Expression = require('./expression');

class TrueExp extends Expression {
    execute(inputNoteSet, executionContext, searchContext) {
        return inputNoteSet;
    }
}

module.exports = TrueExp;
