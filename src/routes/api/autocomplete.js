"use strict";

const noteCacheService = require('../../services/note_cache');
const repository = require('../../services/repository');
const log = require('../../services/log');
const utils = require('../../services/utils');
const optionService = require('../../services/options');

async function getAutocomplete(req) {
    const query = req.query.query;
    const activeNoteId = req.query.activeNoteId || 'none';

    let results;

    const timestampStarted = Date.now();

    if (query.trim().length === 0) {
        results = await getRecentNotes(activeNoteId);
    }
    else {
        results = await noteCacheService.findNotes(query);
    }

    const msTaken = Date.now() - timestampStarted;

    if (msTaken >= 100) {
        log.info(`Slow autocomplete took ${msTaken}ms`);
    }

    return results;
}

async function getRecentNotes(activeNoteId) {
    let extraCondition = '';

    const hoistedNoteId = await optionService.getOption('hoistedNoteId');
    if (hoistedNoteId !== 'root') {
        extraCondition = `AND recent_notes.notePath LIKE '%${utils.sanitizeSql(hoistedNoteId)}%'`;
    }

    const recentNotes = await repository.getEntities(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN notes USING(noteId)
      WHERE
        recent_notes.isDeleted = 0
        AND notes.isDeleted = 0
        AND notes.noteId != ?
        ${extraCondition}
      ORDER BY 
        utcDateCreated DESC
      LIMIT 200`, [activeNoteId]);

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