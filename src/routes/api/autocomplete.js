"use strict";

const noteCacheService = require('../../services/note_cache/note_cache_service');
const searchService = require('../../services/search/services/search.js');
const repository = require('../../services/repository');
const log = require('../../services/log');
const utils = require('../../services/utils');
const optionService = require('../../services/options');

function getAutocomplete(req) {
    const query = req.query.query.trim();
    const activeNoteId = req.query.activeNoteId || 'none';

    let results;

    const timestampStarted = Date.now();

    if (query.length === 0) {
        results = getRecentNotes(activeNoteId);
    }
    else {
        results = searchService.searchNotesForAutocomplete(query);
    }

    const msTaken = Date.now() - timestampStarted;

    if (msTaken >= 100) {
        log.info(`Slow autocomplete took ${msTaken}ms`);
    }

    return results;
}

function getRecentNotes(activeNoteId) {
    let extraCondition = '';
    const params = [activeNoteId];

    const hoistedNoteId = optionService.getOption('hoistedNoteId');
    if (hoistedNoteId !== 'root') {
        extraCondition = `AND recent_notes.notePath LIKE ?`;
        params.push(hoistedNoteId + '%');
    }

    const recentNotes = repository.getEntities(`
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
      LIMIT 200`, params);

    return recentNotes.map(rn => {
        const notePathArray = rn.notePath.split('/');

        const noteTitle = noteCacheService.getNoteTitle(notePathArray[notePathArray.length - 1]);
        const notePathTitle = noteCacheService.getNoteTitleForPath(notePathArray);

        return {
            notePath: rn.notePath,
            noteTitle,
            notePathTitle,
            highlightedNotePathTitle: utils.escapeHtml(notePathTitle)
        };
    });
}

module.exports = {
    getAutocomplete
};
