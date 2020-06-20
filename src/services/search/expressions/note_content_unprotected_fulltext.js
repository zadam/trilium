"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const noteCache = require('../../note_cache/note_cache');
const utils = require('../../utils');

class NoteContentUnprotectedFulltextExp extends Expression {
    constructor(operator, tokens) {
        super();

        if (operator !== '*=*') {
            throw new Error(`Note content can be searched only with *=* operator`);
        }

        this.tokens = tokens;
    }

    execute(inputNoteSet) {
        const resultNoteSet = new NoteSet();
        const wheres = this.tokens.map(token => "note_contents.content LIKE " + utils.prepareSqlForLike('%', token, '%'));

        const sql = require('../../sql');
console.log(`
            SELECT notes.noteId 
            FROM notes
            JOIN note_contents ON notes.noteId = note_contents.noteId
            WHERE isDeleted = 0 AND isProtected = 0 AND ${wheres.join(' AND ')}`);
        const noteIds = sql.getColumn(`
            SELECT notes.noteId 
            FROM notes
            JOIN note_contents ON notes.noteId = note_contents.noteId
            WHERE isDeleted = 0 AND isProtected = 0 AND ${wheres.join(' AND ')}`);

        for (const noteId of noteIds) {
            if (inputNoteSet.hasNoteId(noteId) && noteId in noteCache.notes) {
                resultNoteSet.add(noteCache.notes[noteId]);
            }
        }

        return resultNoteSet;
    }
}

module.exports = NoteContentUnprotectedFulltextExp;
