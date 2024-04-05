"use strict";

import beccaService = require('../../becca/becca_service');
import searchService = require('../../services/search/services/search');
import log = require('../../services/log');
import utils = require('../../services/utils');
import cls = require('../../services/cls');
import becca = require('../../becca/becca');
import { Request } from 'express';
import ValidationError = require('../../errors/validation_error');

function getAutocomplete(req: Request) {
    if (typeof req.query.query !== "string") {
        throw new ValidationError("Invalid query data type.");
    }
    const query = (req.query.query || "").trim();
    const activeNoteId = req.query.activeNoteId || 'none';

    let results;

    const timestampStarted = Date.now();

    if (query.length === 0 && typeof activeNoteId === "string") {
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

function getRecentNotes(activeNoteId: string) {
    let extraCondition = '';
    const params = [activeNoteId];

    const hoistedNoteId = cls.getHoistedNoteId();
    if (hoistedNoteId !== 'root') {
        extraCondition = `AND recent_notes.notePath LIKE ?`;
        params.push(`%${hoistedNoteId}%`);
    }

    const recentNotes = becca.getRecentNotesFromQuery(`
      SELECT 
        recent_notes.* 
      FROM 
        recent_notes
        JOIN notes USING(noteId)
      WHERE
        notes.isDeleted = 0
        AND notes.noteId != ?
        ${extraCondition}
      ORDER BY 
        utcDateCreated DESC
      LIMIT 200`, params);

    return recentNotes.map(rn => {
        const notePathArray = rn.notePath.split('/');

        const noteTitle = beccaService.getNoteTitle(notePathArray[notePathArray.length - 1]);
        const notePathTitle = beccaService.getNoteTitleForPath(notePathArray);

        return {
            notePath: rn.notePath,
            noteTitle,
            notePathTitle,
            highlightedNotePathTitle: utils.escapeHtml(notePathTitle)
        };
    });
}

export = {
    getAutocomplete
};
