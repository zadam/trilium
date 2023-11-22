"use strict";

const Expression = require('./expression.js');
const NoteSet = require('../note_set.js');
const becca = require('../../../becca/becca.js');

class LabelComparisonExp extends Expression {
    constructor(attributeType, attributeName, comparator) {
        super();

        this.attributeType = attributeType;
        this.attributeName = attributeName.toLowerCase();
        this.comparator = comparator;
    }

    execute(inputNoteSet, executionContext, searchContext) {
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

module.exports = LabelComparisonExp;
