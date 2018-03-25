"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const auth = require('../../services/auth');
const config = require('../../services/config');
const protected_session = require('../../services/protected_session');
const sync_table = require('../../services/sync_table');
const wrap = require('express-promise-wrap').wrap;

router.get('/', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTree = await sql.getRows(`
      SELECT 
        noteTreeId,
        noteId,
        parentNoteId,
        notePosition,
        prefix,
        isExpanded
      FROM
        note_tree 
      WHERE 
        isDeleted = 0
      ORDER BY 
        notePosition`);

    let notes = [{
        noteId: 'root',
        title: 'root',
        isProtected: false,
        type: 'none',
        mime: 'none'
    }];

    notes = notes.concat(await sql.getRows(`
      SELECT 
        notes.noteId,
        notes.title,
        notes.isProtected,
        notes.type,
        notes.mime,
        hideInAutocomplete.attributeId AS 'hideInAutocomplete'
      FROM
        notes
        LEFT JOIN attributes AS hideInAutocomplete ON hideInAutocomplete.noteId = notes.noteId
                             AND hideInAutocomplete.name = 'hide_in_autocomplete'
                             AND hideInAutocomplete.isDeleted = 0
      WHERE 
        notes.isDeleted = 0`));

    protected_session.decryptNotes(req, notes);

    notes.forEach(note => {
        note.hideInAutocomplete = !!note.hideInAutocomplete;
        note.isProtected = !!note.isProtected;
    });

    res.send({
        instanceName: config.General ? config.General.instanceName : null,
        noteTree: noteTree,
        notes: notes,
        start_note_path: await options.getOption('start_note_path')
    });
}));

router.put('/:noteTreeId/set-prefix', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;
    const sourceId = req.headers.source_id;
    const prefix = utils.isEmptyOrWhitespace(req.body.prefix) ? null : req.body.prefix;

    await sql.doInTransaction(async () => {
        await sql.execute("UPDATE note_tree SET prefix = ?, dateModified = ? WHERE noteTreeId = ?", [prefix, utils.nowDate(), noteTreeId]);

        await sync_table.addNoteTreeSync(noteTreeId, sourceId);
    });

    res.send({});
}));

module.exports = router;
