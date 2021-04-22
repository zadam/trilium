"use strict";

const Expression = require('./expression');

class TrueExp extends Expression {
    execute(inputNoteSet, executionContext) {
        return inputNoteSet;
    }
}

module.exports = TrueExp;
