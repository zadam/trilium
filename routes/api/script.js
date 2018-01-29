"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const protected_session = require('../../services/protected_session');
const attributes = require('../../services/attributes');
const script = require('../../services/script');

router.post('/exec/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const ret = await script.executeScript(noteId, req, req.body.script, req.body.params);

    res.send(ret);
}));

router.get('/startup', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteIds = await attributes.getNoteIdsWithAttribute("run_on_startup");

    const scripts = [];

    for (const noteId of noteIds) {
        scripts.push(await getNoteWithSubtreeScript(noteId, req));
    }

    res.send(scripts);
}));

router.get('/subtree/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const noteScript = (await notes.getNoteById(noteId, req)).content;

    const subTreeScripts = await getSubTreeScripts(noteId, [noteId], req);

    res.send(subTreeScripts + noteScript);
}));

async function getNoteWithSubtreeScript(noteId, req) {
    const noteScript = (await notes.getNoteById(noteId, req)).content;

    const subTreeScripts = await getSubTreeScripts(noteId, [noteId], req);

    return subTreeScripts + noteScript;
}

async function getSubTreeScripts(parentId, includedNoteIds, dataKey) {
    const children = await sql.getAll(`SELECT notes.noteId, notes.title, notes.content, notes.isProtected, notes.mime 
                                     FROM notes JOIN notes_tree USING(noteId)
                                     WHERE notes_tree.isDeleted = 0 AND notes.isDeleted = 0
                                           AND notes_tree.parentNoteId = ? AND notes.type = 'code'
                                           AND (notes.mime = 'application/javascript' OR notes.mime = 'text/html')`, [parentId]);

    protected_session.decryptNotes(dataKey, children);

    let script = "\r\n";

    for (const child of children) {
        if (includedNoteIds.includes(child.noteId)) {
            return;
        }

        includedNoteIds.push(child.noteId);

        script += await getSubTreeScripts(child.noteId, includedNoteIds, dataKey);

        if (child.mime === 'application/javascript') {
            child.content = '<script>' + child.content + '</script>';
        }

        script += child.content + "\r\n";
    }

    return script;
}

module.exports = router;