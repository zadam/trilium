"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const notes = require('../../services/notes');
const attributes = require('../../services/attributes');
const script = require('../../services/script');
const Repository = require('../../services/repository');

router.post('/exec', auth.checkApiAuth, wrap(async (req, res, next) => {
    const ret = await script.executeScript(req, req.body.script, req.body.params);

    res.send({
        executionResult: ret
    });
}));

router.post('/job', auth.checkApiAuth, wrap(async (req, res, next) => {
    await script.setJob(req.body);

    res.send({});
}));

router.get('/startup', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteIds = await attributes.getNoteIdsWithAttribute("run_on_startup");
    const repository = new Repository(req);

    const scripts = [];

    for (const noteId of noteIds) {
        scripts.push(await getNoteWithSubtreeScript(noteId, repository));
    }

    res.send(scripts);
}));

router.get('/subtree/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const noteId = req.params.noteId;

    res.send(await getNoteWithSubtreeScript(noteId, repository));
}));

async function getNoteWithSubtreeScript(noteId, repository) {
    const note = await repository.getNote(noteId);

    let noteScript = note.content;

    if (note.isJavaScript()) {
        // last \r\n is necessary if script contains line comment on its last line
        noteScript = "(async function() {" + noteScript + "\r\n})()";
    }

    const subTreeScripts = await getSubTreeScripts(noteId, [noteId], repository, note.isJavaScript());

    return subTreeScripts + noteScript;
}

async function getSubTreeScripts(parentId, includedNoteIds, repository, isJavaScript) {
    const children = await repository.getEntities(`
                                      SELECT notes.* 
                                      FROM notes JOIN note_tree USING(noteId)
                                      WHERE note_tree.isDeleted = 0 AND notes.isDeleted = 0
                                           AND note_tree.parentNoteId = ? AND (notes.type = 'code' OR notes.type = 'file')
                                           AND (notes.mime = 'application/javascript' 
                                                OR notes.mime = 'application/x-javascript' 
                                                OR notes.mime = 'text/html')`, [parentId]);

    let script = "\r\n";

    for (const child of children) {
        if (includedNoteIds.includes(child.noteId)) {
            return;
        }

        includedNoteIds.push(child.noteId);

        script += await getSubTreeScripts(child.noteId, includedNoteIds, repository);

        if (!isJavaScript && child.isJavaScript()) {
            child.content = '<script>' + child.content + '</script>';
        }

        script += child.content + "\r\n";
    }

    return script;
}

module.exports = router;