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
    const repository = new Repository(req);
    const notes = await attributes.getNotesWithAttribute(repository, "run", "frontend_startup");

    const scripts = [];

    for (const note of notes) {
        const bundle = await script.getScriptBundle(note);

        scripts.push(bundle.script);
    }

    res.send(scripts);
}));

router.get('/subtree/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);
    const bundle = await script.getScriptBundle(note);

    res.send(bundle.script);
}));

router.get('/render/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);

    res.send(await script.getRenderScript(note));
}));

module.exports = router;