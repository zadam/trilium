"use strict";

const Expression = require('./expression.js');

class TrueExp extends Expression {
    execute(inputNoteSet, executionContext, searchContext) {
        return inputNoteSet;
    }
}

module.exports = TrueExp;
