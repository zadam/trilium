"use strict";

class Expression {
    constructor() {
        this.name = this.constructor.name; // for DEBUG mode to have expression name as part of dumped JSON
    }

    /**
     * @param {NoteSet} inputNoteSet
     * @param {object} executionContext
     * @param {SearchContext} searchContext
     * @returns {NoteSet}
     */
    execute(inputNoteSet, executionContext, searchContext) {}
}

module.exports = Expression;
