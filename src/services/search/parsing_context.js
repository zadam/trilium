"use strict";

class ParsingContext {
    constructor(includeNoteContent) {
        this.includeNoteContent = includeNoteContent;
        this.highlightedTokens = [];
        this.error = null;
    }

    addError(error) {
        // we record only the first error, subsequent ones are usually consequence of the first
        if (!this.error) {
            this.error = error;
        }
    }
}

module.exports = ParsingContext;
