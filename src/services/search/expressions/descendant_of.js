"use strict";

import Expression from './expression.js'
import NoteSet from '../note_set.js'
import becca from '../../../becca/becca.js'

class DescendantOfExp extends Expression {
    constructor(subExpression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        const subInputNoteSet = new NoteSet(Object.values(becca.notes));
        const subResNoteSet = this.subExpression.execute(subInputNoteSet, executionContext, searchContext);

        const subTreeNoteSet = new NoteSet();

        for (const note of subResNoteSet.notes) {
            subTreeNoteSet.addAll(note.getSubtree().notes);
        }

        return inputNoteSet.intersection(subTreeNoteSet);
    }
}

export default DescendantOfExp;
