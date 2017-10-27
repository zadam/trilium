"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('/:full_load_time', auth.checkApiAuth, async (req, res, next) => {
    const fullLoadTime = req.params.full_load_time;

    const browserId = req.get('x-browser-id');

    const row = await sql.getSingleResult("SELECT COUNT(*) AS 'count' FROM audit_log WHERE (browser_id IS NULL OR browser_id != ?) " +
        "AND date_modified >= ?", [browserId, fullLoadTime]);

    console.log("SELECT COUNT(*) AS 'count' FROM audit_log WHERE (browser_id IS NULL OR browser_id != ?) " +
        "AND date_modified >= ?");

    res.send({
        'changed': row.count > 0
    });
});

module.exports = router;