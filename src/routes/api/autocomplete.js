"use strict";

const noteCacheService = require('../../services/note_cache');
const repository = require('../../services/repository');
const log = require('../../services/log');

async function getAutocomplete(req) {
    const query = req.query.query;
    const currentNoteId = req.query.currentNoteId || 'none';

    let results;

    const timestampStarted = Date.now();

    if (query.trim().length === 0) {
        results = await getRecentNotes(currentNoteId);
    }
    else {
        results = noteCacheService.findNotes(query);
    }

    const msTaken = Date.now() - timestampStarted;

    if (msTaken >= 100) {
        log.info(`Slow autocomplete took ${msTaken}ms`);
    }

    return results;
}

async function getRecentNotes(currentNoteId) {
    const recentNotes = await repository.getEntities(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN branches USING(branchId)
      WHERE
        recent_notes.isDeleted = 0
        AND branches.isDeleted = 0
        AND branches.noteId != ?
      ORDER BY 
        dateCreated DESC
      LIMIT 200`, [currentNoteId]);

    return recentNotes.map(rn => {
        const title = noteCacheService.getNoteTitleForPath(rn.notePath.split('/'));

        return {
            path: rn.notePath,
            title: title,
            highlighted: title
        };
    });
}

module.exports = {
    getAutocomplete
};