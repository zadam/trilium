"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');

router.post('/execute', auth.checkApiAuth, async (req, res, next) => {
    const query = req.body.query;

    try {
        res.send({
            success: true,
            rows: await sql.getAll(query)
        });
    }
    catch (e) {
        res.send({
            success: false,
            error: e.message
        });
    }
});

module.exports = router;