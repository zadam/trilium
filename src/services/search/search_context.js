"use strict";

const cls = require('../cls');

class SearchContext {
    constructor(params = {}) {
        this.fastSearch = !!params.fastSearch;
        this.includeArchivedNotes = !!params.includeArchivedNotes;
        this.ignoreHoistedNote = !!params.ignoreHoistedNote;
        this.ancestorNoteId = params.ancestorNoteId;

        if (!this.ancestorNoteId && !this.ignoreHoistedNote) {
            this.ancestorNoteId = cls.getHoistedNoteId();
        }

        this.ancestorDepth = params.ancestorDepth;
        this.orderBy = params.orderBy;
        this.orderDirection = params.orderDirection;
        this.limit = params.limit;
        this.debug = params.debug;
        this.debugInfo = null;
        this.fuzzyAttributeSearch = !!params.fuzzyAttributeSearch;
        this.highlightedTokens = [];
        this.originalQuery = "";
        // if true, becca does not have (up-to-date) information needed to process the query
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
