"use strict";

const sql = require('../../services/sql');

async function getRecentChanges() {
    const recentChanges = await sql.getRows(
        `SELECT 
            notes.isDeleted AS current_isDeleted,
            notes.title AS current_title,
            note_revisions.*
        FROM 
            note_revisions
            JOIN notes USING(noteId)
        ORDER BY 
            dateModifiedTo DESC 
        LIMIT 1000`);

    return recentChanges;
}

module.exports = {
    getRecentChanges
};