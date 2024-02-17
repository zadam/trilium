"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import becca = require('../../../becca/becca');
import SearchContext = require('../search_context');

type Comparator = (value: string) => boolean;

class LabelComparisonExp extends Expression {
    
    private attributeType: string;
    private attributeName: string;
    private comparator: Comparator;

    constructor(attributeType: string, attributeName: string, comparator: Comparator) {
        super();

        this.attributeType = attributeType;
        this.attributeName = attributeName.toLowerCase();
        this.comparator = comparator;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        const attrs = becca.findAttributes(this.attributeType, this.attributeName);
        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;
            const value = attr.value?.toLowerCase();

            if (inputNoteSet.hasNoteId(note.noteId) && this.comparator(value)) {
                if (attr.isInheritable) {
                    resultNoteSet.addAll(note.getSubtreeNotesIncludingTemplated());
                }
                else if (note.isInherited()) {
                    resultNoteSet.addAll(note.getInheritingNotes());
                }
                else {
                    resultNoteSet.add(note);
                }
            }
        }

        return resultNoteSet;
    }
}

export = LabelComparisonExp;
