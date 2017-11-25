"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const auth = require('../../services/auth');
const sync = require('../../services/sync');
const source_id = require('../../services/source_id');

router.post('', auth.checkApiAuth, async (req, res, next) => {
    const treeLoadTime = req.body.treeLoadTime;
    const currentNoteId = req.body.currentNoteId;
    const currentNoteLoadTime = req.body.currentNoteLoadTime;

    const noteTreeChangesCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE entity_name = 'notes_tree' AND source_id != ? " +
        "AND sync_date >= ?", [source_id.currentSourceId, treeLoadTime]);

    const currentNoteChangesCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE source_id != ? " +
        "AND sync_date >= ? AND entity_name = 'notes' AND entity_id = ?", [source_id.currentSourceId, currentNoteLoadTime, currentNoteId]);

    let changesToPushCount = 0;

    if (sync.isSyncSetup) {
        const lastSyncedPush = await options.getOption('last_synced_push');
        changesToPushCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);
    }

    res.send({
        'changedTree': noteTreeChangesCount > 0,
        'changedCurrentNote': currentNoteChangesCount > 0,
        'changesToPushCount': changesToPushCount
    });
});

module.exports = router;