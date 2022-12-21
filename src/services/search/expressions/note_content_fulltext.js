"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const log = require('../../log');
const becca = require('../../../becca/becca');
const protectedSessionService = require('../../protected_session');
const striptags = require('striptags');
const utils = require("../../utils");

const ALLOWED_OPERATORS = ['=', '!=', '*=*', '*=', '=*', '%='];

const cachedRegexes = {};

function getRegex(str) {
    if (!(str in cachedRegexes)) {
        cachedRegexes[str] = new RegExp(str, 'ms'); // multiline, dot-all
    }

    return cachedRegexes[str];
}

class NoteContentFulltextExp extends Expression {
    constructor(operator, {tokens, raw, flatText}) {
        super();

        this.operator = operator;
        this.tokens = tokens;
        this.raw = !!raw;
        this.flatText = !!flatText;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        if (!ALLOWED_OPERATORS.includes(this.operator)) {
            searchContext.addError(`Note content can be searched only with operators: ${ALLOWED_OPERATORS.join(", ")}, operator ${this.operator} given.`);

            return inputNoteSet;
        }

        const resultNoteSet = new NoteSet();
        const sql = require('../../sql');

        for (let {noteId, type, mime, content, isProtected} of sql.iterateRows(`
                SELECT noteId, type, mime, content, isProtected
                FROM notes JOIN note_contents USING (noteId) 
                WHERE type IN ('text', 'code', 'mermaid') AND isDeleted = 0`)) {

            if (!inputNoteSet.hasNoteId(noteId) || !(noteId in becca.notes)) {
                continue;
            }

            if (isProtected) {
                if (!protectedSessionService.isProtectedSessionAvailable()) {
                    continue;
                }

                try {
                    content = protectedSessionService.decryptString(content);
                } catch (e) {
                    log.info(`Cannot decrypt content of note ${noteId}`);
                    continue;
                }
            }

            content = this.preprocessContent(content, type, mime);

            if (this.tokens.length === 1) {
                const [token] = this.tokens;

                if ((this.operator === '=' && token === content)
                    || (this.operator === '!=' && token !== content)
                    || (this.operator === '*=' && content.endsWith(token))
                    || (this.operator === '=*' && content.startsWith(token))
                    || (this.operator === '*=*' && content.includes(token))
                    || (this.operator === '%=' && getRegex(token).test(content))) {

                    resultNoteSet.add(becca.notes[noteId]);
                }
            }
            else {
                const nonMatchingToken = this.tokens.find(token =>
                    !content.includes(token) &&
                    (
                        // in case of default fulltext search we should consider both title, attrs and content
                        // so e.g. "hello world" should match when "hello" is in title and "world" in content
                        !this.flatText
                        || !becca.notes[noteId].getFlatText().includes(token)
                    )
                );

                if (!nonMatchingToken) {
                    resultNoteSet.add(becca.notes[noteId]);
                }
            }
        }

        return resultNoteSet;
    }

    preprocessContent(content, type, mime) {
        content = utils.normalize(content.toString());

        if (type === 'text' && mime === 'text/html') {
            if (!this.raw && content.length < 20000) { // striptags is slow for very large notes
                // allow link to preserve URLs: https://github.com/zadam/trilium/issues/2412
                content = striptags(content, ['a'], ' ');

                // at least the closing tag can be easily stripped
                content = content.replace(/<\/a>/ig, "");
            }

            content = content.replace(/&nbsp;/g, ' ');
        }

        return content.trim();
    }
}

module.exports = NoteContentFulltextExp;
