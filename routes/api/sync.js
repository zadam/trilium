"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sync = require('../../services/sync');

router.get('/changed/:since', auth.checkApiAuth, async (req, res, next) => {
    const since = parseInt(req.params.since);

    res.send(await sync.getChangedSince(since));
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

router.put('/note', auth.checkApiAuth, async (req, res, next) => {
    await sync.putNote(req.body);

    res.send({});
});

module.exports = router;