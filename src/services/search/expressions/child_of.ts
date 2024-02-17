"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import SearchContext = require('../search_context');

class ChildOfExp extends Expression {

    private subExpression: Expression;

    constructor(subExpression: Expression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const subInputNoteSet = new NoteSet();

        for (const note of inputNoteSet.notes) {
            subInputNoteSet.addAll(note.parents);
        }

        const subResNoteSet = this.subExpression.execute(subInputNoteSet, executionContext, searchContext);

        const resNoteSet = new NoteSet();

        for (const parentNote of subResNoteSet.notes) {
            for (const childNote of parentNote.children) {
                if (inputNoteSet.hasNote(childNote)) {
                    resNoteSet.add(childNote);
                }
            }
        }

        return resNoteSet;
    }
}

export = ChildOfExp;
