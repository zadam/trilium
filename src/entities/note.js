"use strict";

class Note {
    constructor(sql, row) {
        this.sql = sql;

        for (const key in row) {
            this[key] = row[key];
        }
    }

    async attributes() {
        return this.sql.getRows("SELECT * FROM attributes WHERE noteId = ?", [this.noteId]);
    }

    async revisions() {
        return this.sql.getRows("SELECT * FROM note_revisions WHERE noteId = ?", [this.noteId]);
    }
}

module.exports = Note;