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

    const repository = new Repository(req);

    const noteScript = (await repository.getNote(noteId)).content;

    const subTreeScripts = await getSubTreeScripts(noteId, [noteId], repository);

    res.send(subTreeScripts + noteScript);
}));

async function getNoteWithSubtreeScript(noteId, req) {
    const noteScript = (await notes.getNoteById(noteId, req)).content;

    const subTreeScripts = await getSubTreeScripts(noteId, [noteId], req);

    return subTreeScripts + noteScript;
}

async function getSubTreeScripts(parentId, includedNoteIds, repository) {
    const children = await repository.getEntities(`
                                      SELECT notes.* 
                                      FROM notes JOIN note_tree USING(noteId)
                                      WHERE note_tree.isDeleted = 0 AND notes.isDeleted = 0
                                           AND note_tree.parentNoteId = ? AND notes.type = 'code'
                                           AND (notes.mime = 'application/javascript' OR notes.mime = 'text/html')`, [parentId]);

    let script = "\r\n";

    for (const child of children) {
        if (includedNoteIds.includes(child.noteId)) {
            return;
        }

        includedNoteIds.push(child.noteId);

        script += await getSubTreeScripts(child.noteId, includedNoteIds, repository);

        if (child.mime === 'application/javascript') {
            child.content = '<script>' + child.content + '</script>';
        }

        script += child.content + "\r\n";
    }

    return script;
}

module.exports = router;