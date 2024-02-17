"use strict";

import { RecentNoteRow } from "./rows";

import dateUtils = require('../../services/date_utils');
import AbstractBeccaEntity = require('./abstract_becca_entity');

/**
 * RecentNote represents recently visited note.
 */
class BRecentNote extends AbstractBeccaEntity<BRecentNote> {
    static get entityName() { return "recent_notes"; }
    static get primaryKeyName() { return "noteId"; }

    noteId: string;
    notePath: string;
    utcDateCreated: string;

    constructor(row: RecentNoteRow) {
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

module.exports = BRecentNote;
