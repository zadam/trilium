"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const log = require('../../services/log');

router.post('/exec', auth.checkApiAuth, wrap(async (req, res, next) => {
    log.info('Executing script: ' + req.body.script);

    const ret = await eval("(" + req.body.script + ")()");

    log.info('Execution result: ' + ret);

    res.send(ret);
}));

module.exports = router;