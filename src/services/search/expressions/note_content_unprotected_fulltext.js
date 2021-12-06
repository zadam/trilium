"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const becca = require('../../../becca/becca');
const striptags = require('striptags');
const utils = require("../../utils");

// FIXME: create common subclass with NoteContentProtectedFulltextExp to avoid duplication
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

            content = this.preprocessContent(content, type, mime);

            if (!this.tokens.find(token => !content.includes(token))) {
                resultNoteSet.add(becca.notes[noteId]);
            }
        }

        return resultNoteSet;
    }

    preprocessContent(content, type, mime) {
        content = utils.normalize(content.toString());

        if (type === 'text' && mime === 'text/html') {
            if (!this.raw && content.length < 20000) { // striptags is slow for very large notes
                // allow link to preserve URLs: https://github.com/zadam/trilium/issues/2412
                content = striptags(content, ['a']);

                // at least the closing tag can be easily stripped
                content = content.replace(/<\/a>/ig, "");
            }

            content = content.replace(/&nbsp;/g, ' ');
        }
        return content;
    }
}

module.exports = NoteContentUnprotectedFulltextExp;
