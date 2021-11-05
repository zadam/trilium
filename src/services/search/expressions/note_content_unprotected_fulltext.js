"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const becca = require('../../../becca/becca');
const striptags = require('striptags');
const utils = require("../../utils");

class NoteContentUnprotectedFulltextExp extends Expression {
    constructor(operator, tokens, raw) {
        super();

        if (operator !== '*=*') {
            throw new Error(`Note content can be searched only with *=* operator`);
        }

        this.tokens = tokens;
        this.raw = !!raw;
    }

    execute(inputNoteSet) {
        const resultNoteSet = new NoteSet();

        const sql = require('../../sql');

        for (let {noteId, type, mime, content} of sql.iterateRows(`
                SELECT noteId, type, mime, content 
                FROM notes JOIN note_contents USING (noteId) 
                WHERE type IN ('text', 'code') AND isDeleted = 0 AND isProtected = 0`)) {

            if (!inputNoteSet.hasNoteId(noteId) || !(noteId in becca.notes)) {
                continue;
            }

            content = utils.normalize(content.toString());

            if (type === 'text' && mime === 'text/html') {
                if (!this.raw && content.length < 20000) { // striptags is slow for very large notes
                    content = striptags(content);
                }

                content = content.replace(/&nbsp;/g, ' ');
            }

            if (!this.tokens.find(token => !content.includes(token))) {
                resultNoteSet.add(becca.notes[noteId]);
            }
        }

        return resultNoteSet;
    }
}

module.exports = NoteContentUnprotectedFulltextExp;
