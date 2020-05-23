"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');

class DescendantOfExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, searchContext) {
        const resNoteSet = new NoteSet();

        for (const note of inputNoteSet.notes) {
            const subInputNoteSet = new NoteSet(note.ancestors);

            const subResNoteSet = this.subExpression.execute(subInputNoteSet, searchContext);

            if (subResNoteSet.notes.length > 0) {
                resNoteSet.add(note);
            }
        }

        return resNoteSet;
    }
}

module.exports = DescendantOfExp;
