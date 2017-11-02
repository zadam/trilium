"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const sync = require('../../services/sync');
const audit_category = require('../../services/audit_category');

router.post('', auth.checkApiAuth, async (req, res, next) => {
    const treeLoadTime = req.body.treeLoadTime;
    const currentNoteId = req.body.currentNoteId;
    const currentNoteDateModified = req.body.currentNoteDateModified;

    const browserId = req.get('x-browser-id');

    const noteTreeChangesCount = await sql.getSingleValue("SELECT COUNT(*) FROM audit_log WHERE (browser_id IS NULL OR browser_id != ?) " +
        "AND date_modified >= ? AND category IN (?, ?, ?)", [browserId, treeLoadTime,
        audit_category.UPDATE_TITLE, audit_category.CHANGE_PARENT, audit_category.CHANGE_POSITION]);

    const currentNoteChangesCount = await sql.getSingleValue("SELECT COUNT(*) FROM audit_log WHERE (browser_id IS NULL OR browser_id != ?) " +
        "AND date_modified >= ? AND note_id = ? AND category IN (?)", [browserId, currentNoteDateModified, currentNoteId,
        audit_category.UPDATE_CONTENT]);

    if (currentNoteChangesCount > 0) {
        console.log("Current note changed!");
        console.log("SELECT COUNT(*) FROM audit_log WHERE (browser_id IS NULL OR browser_id != '" + browserId + "') " +
            "AND date_modified >= " + currentNoteDateModified + " AND note_id = '" + currentNoteId + "' AND category IN ('" + audit_category.UPDATE_CONTENT + "')");
    }

    let changesToPushCount = 0;

    if (sync.isSyncSetup) {
        const lastSyncedPush = await sql.getOption('last_synced_push');
        changesToPushCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);
    }

    res.send({
        'changedTree': noteTreeChangesCount > 0,
        'changedCurrentNote': currentNoteChangesCount > 0,
        'changesToPushCount': changesToPushCount
    });
});

module.exports = router;