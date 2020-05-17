"use strict";

class NoteContentFulltextExp {
    constructor(tokens) {
        this.tokens = tokens;
    }

    async execute(noteSet) {
        const resultNoteSet = new NoteSet();
        const wheres = this.tokens.map(token => "note_contents.content LIKE " + utils.prepareSqlForLike('%', token, '%'));

        const noteIds = await sql.getColumn(`
            SELECT notes.noteId 
            FROM notes
            JOIN note_contents ON notes.noteId = note_contents.noteId
            WHERE isDeleted = 0 AND isProtected = 0 AND ${wheres.join(' AND ')}`);

        const results = [];

        for (const noteId of noteIds) {
            if (noteSet.hasNoteId(noteId) && noteId in notes) {
                resultNoteSet.add(notes[noteId]);
            }
        }

        return results;
    }
}

module.exports = NoteContentFulltextExp;
