"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const noteCache = require('../../note_cache/note_cache');

class LabelComparisonExp extends Expression {
    constructor(attributeType, attributeName, comparator) {
        super();

        this.attributeType = attributeType;
        this.attributeName = attributeName.toLowerCase();
        this.comparator = comparator;
    }

    execute(inputNoteSet) {
        const attrs = noteCache.findAttributes(this.attributeType, this.attributeName);
        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;
            const value = attr.value ? attr.value.toLowerCase() : attr.value;

            if (inputNoteSet.hasNoteId(note.noteId) && this.comparator(value)) {
                if (attr.isInheritable) {
                    resultNoteSet.addAll(note.subtreeNotesIncludingTemplated);
                }
                else if (note.isTemplate) {
                    resultNoteSet.addAll(note.templatedNotes);
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
