"use strict";

const Expression = require('./expression.js');
const NoteSet = require('../note_set.js');

/**
 * Note is hidden when all its note paths start in hidden subtree (i.e., the note is not cloned into visible tree)
 */
class IsHiddenExp extends Expression {
    execute(inputNoteSet, executionContext, searchContext) {
        const resultNoteSet = new NoteSet();

        for (const note of inputNoteSet.notes) {
            if (note.isHiddenCompletely()) {
                resultNoteSet.add(note);
            }
        }

        return resultNoteSet;
    }
}

module.exports = IsHiddenExp;
