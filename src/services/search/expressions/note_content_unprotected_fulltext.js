"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const noteCache = require('../../note_cache/note_cache');
const striptags = require('striptags');

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

        const sql = require('../../sql');

        for (let {noteId, type, mime, content} of sql.iterateRows(`
                SELECT noteId, type, mime, content 
                FROM notes JOIN note_contents USING (noteId) 
                WHERE type IN ('text', 'code') AND isDeleted = 0 AND isProtected = 0`)) {

            content = content.toString().toLowerCase();

            if (type === 'text'
                && mime === 'text/html'
                && content.length < 50000 // striptags is very slow for large notes
            ) {
                content = striptags(content);
                content = content.replace(/&nbsp;/g, ' ');
            }

            if (this.tokens.find(token => !content.includes(token))) {
                continue;
            }

            if (inputNoteSet.hasNoteId(noteId) && noteId in noteCache.notes) {
                resultNoteSet.add(noteCache.notes[noteId]);
            }
        }

        return resultNoteSet;
    }
}

module.exports = NoteContentUnprotectedFulltextExp;
