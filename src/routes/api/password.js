"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const changePassword = require('../../services/change_password');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.post('/change', auth.checkApiAuth, wrap(async (req, res, next) => {
    const result = await changePassword.changePassword(req.body['current_password'], req.body['new_password'], req);

    res.send(result);
}));

module.exports = router;