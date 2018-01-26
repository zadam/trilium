"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const log = require('../../services/log');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const protected_session = require('../../services/protected_session');

router.post('/exec', auth.checkApiAuth, wrap(async (req, res, next) => {
    log.info('Executing script: ' + req.body.script);

    const ret = await eval("(" + req.body.script + ")()");

    log.info('Execution result: ' + ret);

    res.send(ret);
}));

router.get('/subtree/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const noteScript = (await notes.getNoteById(noteId, req)).note_text;

    const subTreeScripts = await getSubTreeScripts(noteId, [noteId], req);

    res.send(subTreeScripts + noteScript);
}));

async function getSubTreeScripts(parentId, includedNoteIds, dataKey) {
    const children = await sql.getAll(`SELECT notes.note_id, notes.note_title, notes.note_text, notes.is_protected 
                                     FROM notes JOIN notes_tree USING(note_id)
                                     WHERE notes_tree.is_deleted = 0 AND notes.is_deleted = 0
                                           AND notes_tree.parent_note_id = ? AND notes.type = 'code'
                                           AND (notes.mime = 'application/javascript' OR notes.mime = 'text/html')`, [parentId]);

    protected_session.decryptNotes(dataKey, children);

    let script = "\r\n";

    for (const child of children) {
        if (includedNoteIds.includes(child.note_id)) {
            return;
        }

        includedNoteIds.push(child.note_id);

        script += await getSubTreeScripts(child.note_id, includedNoteIds, dataKey);

        script += child.note_text + "\r\n";
    }

    return script;
}

module.exports = router;