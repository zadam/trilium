"use strict";

class SearchContext {
    constructor(params = {}) {
        this.includeNoteContent = !!params.includeNoteContent;
        this.excludeArchived = !!params.excludeArchived;
        this.fuzzyAttributeSearch = !!params.fuzzyAttributeSearch;
        this.highlightedTokens = [];
        this.originalQuery = "";
        this.error = null;
    }

    addError(error) {
        // we record only the first error, subsequent ones are usually consequence of the first
        if (!this.error) {
            this.error = error;
        }
    }
}

module.exports = SearchContext;
