"use strict";

const NoteSet = require('../note_set');
const noteCache = require('../../note_cache/note_cache');

class AttributeExistsExp {
    constructor(attributeType, attributeName) {
        this.attributeType = attributeType;
        this.attributeName = attributeName;
    }

    execute(noteSet) {
        const attrs = noteCache.findAttributes(this.attributeType, this.attributeName);
        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;

            if (noteSet.hasNoteId(note.noteId)) {
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
