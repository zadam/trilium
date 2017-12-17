"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const source_id = require('../services/source_id');

router.get('', auth.checkAuth, async (req, res, next) => {
    res.render('index', {
        sourceId: await source_id.generateSourceId()
    });
});

module.exports = router;
