"use strict";

const sql = require('../../services/sql');

async function getNoteLinks(req) {
    const {noteId} = req.params;

    return await sql.getRows(`
        SELECT noteId, targetNoteId, type FROM links WHERE (noteId = ? OR targetNoteId = ?) AND isDeleted = 0
        UNION
        SELECT noteId, value, 'relation' FROM attributes WHERE (noteId = ? OR value = ?) AND type = 'relation' AND isDeleted = 0
        `, [noteId, noteId, noteId, noteId]);
}

module.exports = {
    getNoteLinks
};