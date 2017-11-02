"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');

router.get('/:full_load_time', auth.checkApiAuth, async (req, res, next) => {
    const fullLoadTime = req.params.full_load_time;

    const browserId = req.get('x-browser-id');

    const rowCount = await sql.getSingleValue("SELECT COUNT(*) FROM audit_log WHERE (browser_id IS NULL OR browser_id != ?) " +
        "AND date_modified >= ?", [browserId, fullLoadTime]);

    const lastSyncedPush = await sql.getOption('last_synced_push');
    const changesToPushCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    res.send({
        'changed': rowCount > 0,
        'changesToPushCount': changesToPushCount
    });
});

module.exports = router;