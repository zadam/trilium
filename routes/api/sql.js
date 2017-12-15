"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');

router.post('/execute', auth.checkApiAuth, async (req, res, next) => {
    const query = req.body.query;

    res.send(await sql.getResults(query));
});

module.exports = router;