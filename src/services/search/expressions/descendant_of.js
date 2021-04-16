"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const becca = require('../../note_cache/note_cache');

class DescendantOfExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, executionContext) {
        const subInputNoteSet = new NoteSet(Object.values(becca.notes));
        const subResNoteSet = this.subExpression.execute(subInputNoteSet, executionContext);

        const subTreeNoteSet = new NoteSet();

        for (const note of subResNoteSet.notes) {
            subTreeNoteSet.addAll(note.subtreeNotes);
        }

        return inputNoteSet.intersection(subTreeNoteSet);
    }
}

module.exports = DescendantOfExp;
