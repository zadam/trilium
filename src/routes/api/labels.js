"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const sync_table = require('../../services/sync_table');
const utils = require('../../services/utils');
const wrap = require('express-promise-wrap').wrap;
const labels = require('../../services/labels');

router.get('/notes/:noteId/labels', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    res.send(await sql.getRows("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]));
}));

router.put('/notes/:noteId/labels', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const labels = req.body;
    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        for (const attr of labels) {
            if (attr.labelId) {
                await sql.execute("UPDATE labels SET name = ?, value = ?, dateModified = ?, isDeleted = ?, position = ? WHERE labelId = ?",
                    [attr.name, attr.value, now, attr.isDeleted, attr.position, attr.labelId]);
            }
            else {
                // if it was "created" and then immediatelly deleted, we just don't create it at all
                if (attr.isDeleted) {
                    continue;
                }

                attr.labelId = utils.newLabelId();

                await sql.insert("labels", {
                    labelId: attr.labelId,
                    noteId: noteId,
                    name: attr.name,
                    value: attr.value,
                    position: attr.position,
                    dateCreated: now,
                    dateModified: now,
                    isDeleted: false
                });
            }

            await sync_table.addLabelSync(attr.labelId);
        }
    });

    res.send(await sql.getRows("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]));
}));

router.get('/labels/names', auth.checkApiAuth, wrap(async (req, res, next) => {
    const names = await sql.getColumn("SELECT DISTINCT name FROM labels WHERE isDeleted = 0");

    for (const attr of labels.BUILTIN_LABELS) {
        if (!names.includes(attr)) {
            names.push(attr);
        }
    }

    names.sort();

    res.send(names);
}));

router.get('/labels/values/:labelName', auth.checkApiAuth, wrap(async (req, res, next) => {
    const labelName = req.params.labelName;

    const values = await sql.getColumn("SELECT DISTINCT value FROM labels WHERE isDeleted = 0 AND name = ? AND value != '' ORDER BY value", [labelName]);

    res.send(values);
}));

module.exports = router;