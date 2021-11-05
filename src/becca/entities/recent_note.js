"use strict";

const dateUtils = require('../../services/date_utils.js');
const AbstractEntity = require("./abstract_entity.js");

/**
 * RecentNote represents recently visited note.
 */
class RecentNote extends AbstractEntity {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "noteId"; }

    constructor(row) {
        super();

        this.noteId = row.noteId;
        this.notePath = row.notePath;
        this.utcDateCreated = row.utcDateCreated || dateUtils.utcNowDateTime();
    }

    getPojo() {
        return {
            noteId: this.noteId,
            notePath: this.notePath,
            utcDateCreated: this.utcDateCreated
        }
    }
}

module.exports = RecentNote;
