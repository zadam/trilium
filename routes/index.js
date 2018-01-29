"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const source_id = require('../services/source_id');
const sql = require('../services/sql');
const wrap = require('express-promise-wrap').wrap;

router.get('', auth.checkAuth, wrap(async (req, res, next) => {
    res.render('index', {
        sourceId: await source_id.generateSourceId(),
        maxSyncIdAtLoad: await sql.getFirstValue("SELECT MAX(id) FROM sync")
    });
}));

module.exports = router;
