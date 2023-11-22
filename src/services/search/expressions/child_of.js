"use strict";

const Expression = require('./expression.js');
const NoteSet = require('../note_set.js');

class ChildOfExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, executionContext, searchContext) {
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

module.exports = ChildOfExp;
