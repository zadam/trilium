"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const labels = require('../../services/labels');
const script = require('../../services/script');
const Repository = require('../../services/repository');

router.post('/exec', auth.checkApiAuth, wrap(async (req, res, next) => {
    const ret = await script.executeScript(req, req.body.script, req.body.params, req.body.startNoteId, req.body.currentNoteId);

    res.send({
        executionResult: ret
    });
}));

router.post('/run/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);

    const ret = await script.executeNote(req, note);

    res.send({
        executionResult: ret
    });
}));

router.get('/startup', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const notes = await labels.getNotesWithLabel(repository, "run", "frontend_startup");

    const scripts = [];

    for (const note of notes) {
        const bundle = await script.getScriptBundle(note);

        if (bundle) {
            scripts.push(bundle);
        }
    }

    res.send(scripts);
}));

router.get('/bundle/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);
    const bundle = await script.getScriptBundle(note);

    res.send(bundle);
}));

module.exports = router;