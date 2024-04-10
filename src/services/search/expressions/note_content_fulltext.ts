"use strict";

import { NoteRow } from "../../../becca/entities/rows";
import SearchContext = require("../search_context");

import Expression = require('./expression');
import NoteSet = require('../note_set');
import log = require('../../log');
import becca = require('../../../becca/becca');
import protectedSessionService = require('../../protected_session');
import striptags = require('striptags');
import utils = require('../../utils');
import sql = require("../../sql");

const ALLOWED_OPERATORS = ['=', '!=', '*=*', '*=', '=*', '%='];

const cachedRegexes: Record<string, RegExp> = {};

function getRegex(str: string): RegExp {
    if (!(str in cachedRegexes)) {
        cachedRegexes[str] = new RegExp(str, 'ms'); // multiline, dot-all
    }

    return cachedRegexes[str];
}

interface ConstructorOpts {
    tokens: string[];
    raw?: boolean;
    flatText?: boolean;
}

type SearchRow = Pick<NoteRow, "noteId" | "type" | "mime" | "content" | "isProtected">;

class NoteContentFulltextExp extends Expression {

    private operator: string;
    private tokens: string[];
    private raw: boolean;
    private flatText: boolean;
    
    constructor(operator: string, {tokens, raw, flatText}: ConstructorOpts) {
        super();

        this.operator = operator;
        this.tokens = tokens;
        this.raw = !!raw;
        this.flatText = !!flatText;
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
        if (!ALLOWED_OPERATORS.includes(this.operator)) {
            searchContext.addError(`Note content can be searched only with operators: ${ALLOWED_OPERATORS.join(", ")}, operator ${this.operator} given.`);

            return inputNoteSet;
        }

        const resultNoteSet = new NoteSet();
        
        for (const row of sql.iterateRows<SearchRow>(`
                SELECT noteId, type, mime, content, isProtected
                FROM notes JOIN blobs USING (blobId) 
                WHERE type IN ('text', 'code', 'mermaid') AND isDeleted = 0`)) {

            this.findInText(row, inputNoteSet, resultNoteSet);
        }

        return resultNoteSet;
    }

    findInText({noteId, isProtected, content, type, mime}: SearchRow, inputNoteSet: NoteSet, resultNoteSet: NoteSet) {
        if (!inputNoteSet.hasNoteId(noteId) || !(noteId in becca.notes)) {
            return;
        }

        if (isProtected) {
            if (!protectedSessionService.isProtectedSessionAvailable() || !content) {
                return;
            }

            try {
                content = protectedSessionService.decryptString(content) || undefined;
            } catch (e) {
                log.info(`Cannot decrypt content of note ${noteId}`);
                return;
            }
        }

        if (!content) {
            return;
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
        } else {
            const nonMatchingToken = this.tokens.find(token =>
                !content?.includes(token) &&
                (
                    // in case of default fulltext search, we should consider both title, attrs and content
                    // so e.g. "hello world" should match when "hello" is in title and "world" in content
                    !this.flatText
                    || !becca.notes[noteId].getFlatText().includes(token)
                )
            );

            if (!nonMatchingToken) {
                resultNoteSet.add(becca.notes[noteId]);
            }
        }

        return content;
    }

    preprocessContent(content: string, type: string, mime: string) {
        content = utils.normalize(content.toString());

        if (type === 'text' && mime === 'text/html') {
            if (!this.raw && content.length < 20000) { // striptags is slow for very large notes
                content = this.stripTags(content);
            }

            content = content.replace(/&nbsp;/g, ' ');
        }

        return content.trim();
    }

    stripTags(content: string) {
        // we want to allow link to preserve URLs: https://github.com/zadam/trilium/issues/2412
        // we want to insert space in place of block tags (because they imply text separation)
        // but we don't want to insert text for typical formatting inline tags which can occur within one word
        const linkTag = 'a';
        const inlineFormattingTags = ['b', 'strong', 'em', 'i', 'span', 'big', 'small', 'font', 'sub', 'sup'];

        // replace tags which imply text separation with a space
        content = striptags(content, [linkTag, ...inlineFormattingTags], ' ');

        // replace the inline formatting tags (but not links) without a space
        content = striptags(content, [linkTag], '');

        // at least the closing link tag can be easily stripped
        return content.replace(/<\/a>/ig, "");
    }
}

export = NoteContentFulltextExp;
