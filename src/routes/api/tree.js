"use strict";

const sql = require('../../services/sql');
const optionService = require('../../services/options');
const config = require('../../services/config');
const protectedSessionService = require('../../services/protected_session');

async function getTree() {
    const branches = await sql.getRows(`
      SELECT 
        branchId,
        noteId,
        parentNoteId,
        notePosition,
        prefix,
        isExpanded
      FROM
        branches 
      WHERE 
        isDeleted = 0
      ORDER BY 
        notePosition`);

    const notes = [{
        noteId: 'root',
        title: 'root',
        isProtected: false,
        type: 'none',
        mime: 'none'
    }].concat(await sql.getRows(`
      SELECT 
        notes.noteId,
        notes.title,
        notes.isProtected,
        notes.type,
        notes.mime,
        hideInAutocomplete.labelId AS 'hideInAutocomplete'
      FROM
        notes
        LEFT JOIN labels AS hideInAutocomplete ON hideInAutocomplete.noteId = notes.noteId
                             AND hideInAutocomplete.name = 'hide_in_autocomplete'
                             AND hideInAutocomplete.isDeleted = 0
      WHERE 
        notes.isDeleted = 0`));

    protectedSessionService.decryptNotes(notes);

    notes.forEach(note => {
        note.hideInAutocomplete = !!note.hideInAutocomplete;
        note.isProtected = !!note.isProtected;
    });

    return {
        instanceName: config.General ? config.General.instanceName : null,
        branches: branches,
        notes: notes,
        start_note_path: await optionService.getOption('start_note_path')
    };
}

module.exports = {
    getTree
};
