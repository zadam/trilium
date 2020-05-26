"use strict";

const NoteSet = require('../note_set');
const noteCache = require('../../note_cache/note_cache');
const Expression = require('./expression');

class AttributeExistsExp extends Expression {
    constructor(attributeType, attributeName, prefixMatch) {
        super();

        this.attributeType = attributeType;
        this.attributeName = attributeName;
        this.prefixMatch = prefixMatch;
    }

    execute(inputNoteSet) {
        const attrs = this.prefixMatch
            ? noteCache.findAttributesWithPrefix(this.attributeType, this.attributeName)
            : noteCache.findAttributes(this.attributeType, this.attributeName);

        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;

            if (inputNoteSet.hasNoteId(note.noteId)) {
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

module.exports = AttributeExistsExp;
