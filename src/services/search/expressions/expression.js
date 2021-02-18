"use strict";

class Expression {
    constructor() {
        this.name = this.constructor.name; // for DEBUG mode to have expression name as part of dumped JSON
    }

    /**
     * @param {NoteSet} inputNoteSet
     * @param {object} executionContext
     * @return {NoteSet}
     */
    execute(inputNoteSet, executionContext) {}
}

module.exports = Expression;
