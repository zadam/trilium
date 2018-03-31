"use strict";

const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const config = require('../../services/config');
const protected_session = require('../../services/protected_session');
const sync_table = require('../../services/sync_table');

async function getTree(req) {
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

async function setPrefix(req) {
    const branchId = req.params.branchId;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE branches SET prefix = ?, dateModified = ? WHERE branchId = ?", [prefix, utils.nowDate(), branchId]);

        await sync_table.addBranchSync(branchId);
    });

    return {};
}

module.exports = {
    getTree,
    setPrefix
};
