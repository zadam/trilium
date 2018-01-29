"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const wrap = require('express-promise-wrap').wrap;

router.post('/execute', auth.checkApiAuth, wrap(async (req, res, next) => {
    const query = req.body.query;

    try {
        res.send({
            success: true,
            rows: await sql.getRows(query)
        });
    }
    catch (e) {
        res.send({
            success: false,
            error: e.message
        });
    }
}));

module.exports = router;