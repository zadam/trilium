"use strict";

class SearchContext {
    constructor(params = {}) {
        this.fastSearch = !!params.fastSearch;
        this.ancestorNoteId = params.ancestorNoteId;
        this.ancestorDepth = params.ancestorDepth;
        this.includeArchivedNotes = !!params.includeArchivedNotes;
        this.orderBy = params.orderBy;
        this.orderDirection = params.orderDirection;
        this.fuzzyAttributeSearch = !!params.fuzzyAttributeSearch;
        this.highlightedTokens = [];
        this.originalQuery = "";
        // if true, note cache does not have (up-to-date) information needed to process the query
        // and some extra data needs to be loaded before executing
        this.dbLoadNeeded = false;
        this.error = null;
    }

    addError(error) {
        // we record only the first error, subsequent ones are usually consequence of the first
        if (!this.error) {
            this.error = error;
        }
    }

    hasError() {
        return !!this.error;
    }

    getError() {
        return this.error;
    }
}

module.exports = SearchContext;
