"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sync = require('../../services/sync');

router.post('/now', auth.checkApiAuth, async (req, res, next) => {
    const log = await sync.sync();

    res.send({
        success: true,
        log: log
    });
});

router.get('/changed/:since', auth.checkApiAuth, async (req, res, next) => {
    const since = parseInt(req.params.since);

    const result = await sync.getChangedSince(since);

    res.send(result);
});

router.put('/changed', auth.checkApiAuth, async (req, res, next) => {
    await sync.putChanged(req.body);

    res.send({});
});

router.get('/note/:noteId/:since', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;
    const since = parseInt(req.params.since);

    res.send(await sync.getNoteSince(noteId, since));
});

router.put('/notes', auth.checkApiAuth, async (req, res, next) => {
    await sync.updateNote(req.body);

    res.send({});
});

router.put('/notes_tree', auth.checkApiAuth, async (req, res, next) => {
    await sync.updateNoteTree(req.body);

    res.send({});
});

router.put('/notes_history', auth.checkApiAuth, async (req, res, next) => {
    await sync.updateNoteHistory(req.body);

    res.send({});
});

module.exports = router;