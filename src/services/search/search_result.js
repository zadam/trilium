"use strict";

const beccaService = require('../../becca/becca_service');

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

    computeScore(tokens) {
        this.score = 0;

        // matches in attributes don't get extra points and thus are implicitly valued less than note path matches

        const chunks = this.notePathTitle.toLowerCase().split(" ");

        for (const chunk of chunks) {
            for (const token of tokens) {
                if (chunk === token) {
                    this.score += 4 * token.length;
                }
                else if (chunk.startsWith(token)) {
                    this.score += 2 * token.length;
                }
                else if (chunk.includes(token)) {
                    this.score += token.length;
                }
            }
        }
    }
}

module.exports = SearchResult;
