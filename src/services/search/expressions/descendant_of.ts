"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import becca = require('../../../becca/becca');
import SearchContext = require('../search_context');

class DescendantOfExp extends Expression {
    private subExpression: Expression;

    constructor(subExpression: Expression) {
        super();

        this.subExpression = subExpression;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const subInputNoteSet = new NoteSet(Object.values(becca.notes));
        const subResNoteSet = this.subExpression.execute(subInputNoteSet, executionContext, searchContext);

        const subTreeNoteSet = new NoteSet();

        for (const note of subResNoteSet.notes) {
            subTreeNoteSet.addAll(note.getSubtree().notes);
        }

        return inputNoteSet.intersection(subTreeNoteSet);
    }
}

export = DescendantOfExp;
