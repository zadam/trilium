"use strict";

const repository = require('../../services/repository');
const utils = require('../../services/utils');
const optionService = require('../../services/options');
const RecentNote = require('../../entities/recent_note');

async function getRecentNotes() {
    return await repository.getEntities(`
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

    const recentNote = new RecentNote({
        branchId: branchId,
        notePath: notePath,
        dateAccessed: utils.nowDate(),
        isDeleted: 0
    });

    await recentNote.save();

    await optionService.setOption('start_note_path', notePath);

    return await getRecentNotes();
}

module.exports = {
    getRecentNotes,
    addRecentNote
};