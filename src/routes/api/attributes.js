"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const sync_table = require('../../services/sync_table');
const utils = require('../../services/utils');
const wrap = require('express-promise-wrap').wrap;
const attributes = require('../../services/attributes');

router.get('/notes/:noteId/attributes', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    res.send(await sql.getRows("SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]));
}));

router.put('/notes/:noteId/attributes', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const attributes = req.body;
    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        for (const attr of attributes) {
            if (attr.attributeId) {
                await sql.execute("UPDATE attributes SET name = ?, value = ?, dateModified = ?, isDeleted = ?, position = ? WHERE attributeId = ?",
                    [attr.name, attr.value, now, attr.isDeleted, attr.position, attr.attributeId]);
            }
            else {
                // if it was "created" and then immediatelly deleted, we just don't create it at all
                if (attr.isDeleted) {
                    continue;
                }

                attr.attributeId = utils.newAttributeId();

                await sql.insert("attributes", {
                    attributeId: attr.attributeId,
                    noteId: noteId,
                    name: attr.name,
                    value: attr.value,
                    position: attr.position,
                    dateCreated: now,
                    dateModified: now,
                    isDeleted: false
                });
            }

            await sync_table.addAttributeSync(attr.attributeId);
        }
    });

    res.send(await sql.getRows("SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]));
}));

router.get('/attributes/names', auth.checkApiAuth, wrap(async (req, res, next) => {
    const names = await sql.getColumn("SELECT DISTINCT name FROM attributes WHERE isDeleted = 0");

    for (const attr of attributes.BUILTIN_ATTRIBUTES) {
        if (!names.includes(attr)) {
            names.push(attr);
        }
    }

    names.sort();

    res.send(names);
}));

router.get('/attributes/values/:attributeName', auth.checkApiAuth, wrap(async (req, res, next) => {
    const attributeName = req.params.attributeName;

    const values = await sql.getColumn("SELECT DISTINCT value FROM attributes WHERE isDeleted = 0 AND name = ? AND value != '' ORDER BY value", [attributeName]);

    res.send(values);
}));

module.exports = router;