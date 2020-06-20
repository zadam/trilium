"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const log = require('../../log');
const noteCache = require('../../note_cache/note_cache');
const protectedSessionService = require('../../protected_session');

class NoteContentProtectedFulltextExp extends Expression {
    constructor(operator, tokens) {
        super();

        if (operator !== '*=*') {
            throw new Error(`Note content can be searched only with *=* operator`);
        }

        this.tokens = tokens;
    }

    execute(inputNoteSet) {
        const resultNoteSet = new NoteSet();

        if (!protectedSessionService.isProtectedSessionAvailable()) {
            return resultNoteSet;
        }

        const sql = require('../../sql');

        for (let {noteId, content} of sql.iterateRows(`SELECT noteId, content FROM notes JOIN note_contents USING (noteId) WHERE isDeleted = 0 AND isProtected = 1`)) {

            try {
                content = protectedSessionService.decryptString(content);
            }
            catch (e) {
                log.info('Cannot decrypt content of note', noteId);
                continue;
            }

            content = content.toLowerCase();

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

module.exports = NoteContentProtectedFulltextExp;
