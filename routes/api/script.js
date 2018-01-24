"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const log = require('../../services/log');
const sql = require('../../services/sql');
const protected_session = require('../../services/protected_session');
const data_encryption = require('../../services/data_encryption');

router.post('/exec', auth.checkApiAuth, wrap(async (req, res, next) => {
    log.info('Executing script: ' + req.body.script);

    const ret = await eval("(" + req.body.script + ")()");

    log.info('Execution result: ' + ret);

    res.send(ret);
}));

router.get('/subtree/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const dataKey = protected_session.getDataKey(req);

    res.send(await getSubTreeScripts(noteId, [noteId], dataKey));
}));

async function getSubTreeScripts(parentId, includedNoteIds, dataKey) {
    const childs = await sql.getAll(`SELECT notes.note_id, notes.note_title, notes.note_text, notes.is_protected 
                                     FROM notes JOIN notes_tree USING(note_id)
                                     WHERE notes_tree.is_deleted = 0 AND notes.is_deleted = 0
                                           AND notes_tree.parent_note_id = ? AND notes.type = 'code'
                                           AND notes.mime = 'application/javascript'`, [parentId]);

    let script = "\r\n";

    for (const child of childs) {
        if (includedNoteIds.includes(child.note_id)) {
            return;
        }

        includedNoteIds.push(child.note_id);

        script += await getSubTreeScripts(child.note_id, includedNoteIds, dataKey);

        if (child.is_protected) {
            if (!dataKey) {
                throw new Error("Protected note is included, but script isn't running in protected session.");
            }

            child.note_title = data_encryption.decryptString(dataKey, data_encryption.noteTitleIv(child.note_id), child.note_title);
            child.note_text = data_encryption.decryptString(dataKey, data_encryption.noteTextIv(child.note_id), child.note_text);
        }

        script += '// start of script ' + child.note_title + '\r\n';
        script += child.note_text + "\r\n";
        script += '// end of script ' + child.note_title + '\r\n\r\n';
    }

    return script;
}

module.exports = router;