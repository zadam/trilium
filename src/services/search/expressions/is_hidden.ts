"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import SearchContext = require('../search_context');

/**
 * Note is hidden when all its note paths start in hidden subtree (i.e., the note is not cloned into visible tree)
 */
class IsHiddenExp extends Expression {
    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const resultNoteSet = new NoteSet();

        for (const note of inputNoteSet.notes) {
            if (note.isHiddenCompletely()) {
                resultNoteSet.add(note);
            }
        }

        return resultNoteSet;
    }
}

export = IsHiddenExp;
