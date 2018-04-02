"use strict";

const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const config = require('../../services/config');
const protected_session = require('../../services/protected_session');
const repository = require('../../services/repository');

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

    protected_session.decryptNotes(notes);

    notes.forEach(note => {
        note.hideInAutocomplete = !!note.hideInAutocomplete;
        note.isProtected = !!note.isProtected;
    });

    return {
        instanceName: config.General ? config.General.instanceName : null,
        branches: branches,
        notes: notes,
        start_note_path: await options.getOption('start_note_path')
    };
}

module.exports = {
    getTree
};
