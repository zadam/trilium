"use strict";

const repository = require('../../services/repository');
const optionService = require('../../services/options');
const RecentNote = require('../../entities/recent_note');
const noteCacheService = require('../../services/note_cache');

async function getRecentNotes() {
    const recentNotes = await repository.getEntities(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN branches USING(branchId)
      WHERE
        recent_notes.isDeleted = 0
        AND branches.isDeleted = 0
      ORDER BY 
        dateCreated DESC
      LIMIT 200`);

    for (const rn of recentNotes) {
        rn.title = noteCacheService.getNoteTitleForPath(rn.notePath.split('/'));
    }

    return recentNotes;
}

async function addRecentNote(req) {
    const branchId = req.params.branchId;
    const notePath = req.params.notePath;

    await new RecentNote({
        branchId: branchId,
        notePath: notePath
    }).save();

    await optionService.setOption('startNotePath', notePath);

    return await getRecentNotes();
}

module.exports = {
    getRecentNotes,
    addRecentNote
};