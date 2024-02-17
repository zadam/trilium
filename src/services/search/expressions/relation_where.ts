"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import becca = require('../../../becca/becca');
import SearchContext = require('../search_context');

class RelationWhereExp extends Expression {
    private relationName: string;
    private subExpression: Expression;

    constructor(relationName: string, subExpression: Expression) {
        super();

        this.relationName = relationName;
        this.subExpression = subExpression;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const candidateNoteSet = new NoteSet();

        for (const attr of becca.findAttributes('relation', this.relationName)) {
            const note = attr.note;

            if (inputNoteSet.hasNoteId(note.noteId) && attr.targetNote) {
                const subInputNoteSet = new NoteSet([attr.targetNote]);
                const subResNoteSet = this.subExpression.execute(subInputNoteSet, executionContext, searchContext);

                if (subResNoteSet.hasNote(attr.targetNote)) {
                    if (attr.isInheritable) {
                        candidateNoteSet.addAll(note.getSubtreeNotesIncludingTemplated());
                    } else if (note.isInherited()) {
                        candidateNoteSet.addAll(note.getInheritingNotes());
                    } else {
                        candidateNoteSet.add(note);
                    }
                }
            }
        }

        return candidateNoteSet.intersection(inputNoteSet);
    }
}

export = RelationWhereExp;
