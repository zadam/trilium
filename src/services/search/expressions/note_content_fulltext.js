"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const noteCache = require('../../note_cache/note_cache');

class NoteContentFulltextExp extends Expression {
    constructor(tokens) {
        super();

        this.tokens = tokens;
    }

    async execute(noteSet) {
        const resultNoteSet = new NoteSet();
        const wheres = this.tokens.map(token => "note_contents.content LIKE " + utils.prepareSqlForLike('%', token, '%'));

        const sql = require('../../sql');

        const noteIds = await sql.getColumn(`
            SELECT notes.noteId 
            FROM notes
            JOIN note_contents ON notes.noteId = note_contents.noteId
            WHERE isDeleted = 0 AND isProtected = 0 AND ${wheres.join(' AND ')}`);

        for (const noteId of noteIds) {
            if (noteSet.hasNoteId(noteId) && noteId in noteCache.notes) {
                resultNoteSet.add(noteCache.notes[noteId]);
            }
        }

        return resultNoteSet;
    }
}

module.exports = NoteContentFulltextExp;
