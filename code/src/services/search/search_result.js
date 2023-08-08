"use strict";

const beccaService = require('../../becca/becca_service');
const becca = require('../../becca/becca');

class SearchResult {
    constructor(notePathArray) {
        this.notePathArray = notePathArray;
        this.notePathTitle = beccaService.getNoteTitleForPath(notePathArray);
    }

    get notePath() {
        return this.notePathArray.join('/');
    }

    get noteId() {
        return this.notePathArray[this.notePathArray.length - 1];
    }

    computeScore(fulltextQuery, tokens) {
        this.score = 0;

        const note = becca.notes[this.noteId];

        if (note.title.toLowerCase() === fulltextQuery) {
            this.score += 100; // high reward for exact match #3470
        }

        // notes with matches on its own note title as opposed to ancestors or descendants
        this.addScoreForStrings(tokens, note.title, 1.5);

        // matches in attributes don't get extra points and thus are implicitly valued less than note path matches

        this.addScoreForStrings(tokens, this.notePathTitle, 1);

        if (note.isInHiddenSubtree()) {
            this.score = this.score / 2;
        }
    }

    addScoreForStrings(tokens, str, factor) {
        const chunks = str.toLowerCase().split(" ");

        for (const chunk of chunks) {
            for (const token of tokens) {
                if (chunk === token) {
                    this.score += 4 * token.length * factor;
                } else if (chunk.startsWith(token)) {
                    this.score += 2 * token.length * factor;
                } else if (chunk.includes(token)) {
                    this.score += token.length * factor;
                }
            }
        }
    }
}

module.exports = SearchResult;
