"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const log = require('../../log');
const noteCache = require('../../note_cache/note_cache');

class AncestorExp extends Expression {
    constructor(ancestorNoteId) {
        super();

        this.ancestorNoteId = ancestorNoteId;
    }

    execute(inputNoteSet, executionContext) {
        const ancestorNote = noteCache.notes[this.ancestorNoteId];

        if (!ancestorNote) {
            log.error(`Subtree note '${this.ancestorNoteId}' was not not found.`);

            return new NoteSet([]);
        }

        return new NoteSet(ancestorNote.subtreeNotes).intersection(inputNoteSet);
    }
}

module.exports = AncestorExp;
