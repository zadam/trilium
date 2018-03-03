"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
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
    const noteIds = await attributes.getNoteIdsWithAttribute("run", "frontend_startup");
    const repository = new Repository(req);

    const scripts = [];

    for (const noteId of noteIds) {
        const note = await repository.getNote(noteId);

        scripts.push(await script.getNoteScript(note));
    }

    res.send(scripts);
}));

router.get('/subtree/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);

    res.send(await script.getNoteScript(note, repository));
}));

module.exports = router;