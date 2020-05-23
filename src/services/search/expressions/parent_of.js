"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');

class ParentOfExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, searchContext) {
        const subInputNoteSet = new NoteSet();

        for (const note of inputNoteSet.notes) {
            subInputNoteSet.addAll(note.children);
        }

        const subResNoteSet = this.subExpression.execute(subInputNoteSet, searchContext);

        const resNoteSet = new NoteSet();

        for (const childNote of subResNoteSet.notes) {
            for (const parentNote of childNote.parents) {
                if (inputNoteSet.hasNote(parentNote)) {
                    resNoteSet.add(parentNote);
                }
            }
        }

        return resNoteSet;
    }
}

module.exports = ParentOfExp;
