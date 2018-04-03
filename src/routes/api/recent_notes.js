"use strict";

const repository = require('../../services/repository');
const dateUtils = require('../../services/date_utils');
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

    await new RecentNote({
        branchId: branchId,
        notePath: notePath,
        dateAccessed: dateUtils.nowDate(),
        isDeleted: 0
    }).save();

    await optionService.setOption('startNotePath', notePath);

    return await getRecentNotes();
}

module.exports = {
    getRecentNotes,
    addRecentNote
};