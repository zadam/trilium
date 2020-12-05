"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const log = require('../../log');
const noteCache = require('../../note_cache/note_cache');

class SubTreeExp extends Expression {
    constructor(subTreeNoteId) {
        super();

        this.subTreeNoteId = subTreeNoteId;
    }

    execute(inputNoteSet, searchContext) {
        const subTreeNote = noteCache.notes[this.subTreeNoteId];

        if (!subTreeNote) {
            log.error(`Subtree note '${this.subTreeNoteId}' was not not found.`);

            return new NoteSet([]);
        }

        return new NoteSet(subTreeNote.subtreeNotes).intersection(inputNoteSet);
    }
}

module.exports = SubTreeExp;
