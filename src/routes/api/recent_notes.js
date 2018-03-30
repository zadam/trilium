"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const options = require('../../services/options');

async function getRecentNotes() {
    return await sql.getRows(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN branches USING(branchId)
      WHERE
        recent_notes.isDeleted = 0
        AND branches.isDeleted = 0
      ORDER BY 
        dateAccessed DESC
      LIMIT 200`);
}


async function addRecentNote(req) {
    const branchId = req.params.branchId;
    const notePath = req.params.notePath;
    const sourceId = req.headers.source_id;

    await sql.replace('recent_notes', {
        branchId: branchId,
        notePath: notePath,
        dateAccessed: utils.nowDate(),
        isDeleted: 0
    });

    await sync_table.addRecentNoteSync(branchId, sourceId);

    await options.setOption('start_note_path', notePath, sourceId);

    return await getRecentNotes();
}

module.exports = {
    getRecentNotes,
    addRecentNote
};