"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const sync_table = require('../../services/sync_table');
const utils = require('../../services/utils');
const wrap = require('express-promise-wrap').wrap;

router.get('/:noteId/attributes', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    res.send(await sql.getAll("SELECT * FROM attributes WHERE note_id = ? ORDER BY date_created", [noteId]));
}));

router.put('/:noteId/attributes', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const attributes = req.body;
    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        for (const attr of attributes) {
            if (attr.attribute_id) {
                await sql.execute("UPDATE attributes SET name = ?, value = ?, date_modified = ? WHERE attribute_id = ?",
                    [attr.name, attr.value, now, attr.attribute_id]);
            }
            else {
                attr.attribute_id = utils.newAttributeId();

                await sql.insert("attributes", {
                   attribute_id: attr.attribute_id,
                   note_id: noteId,
                   name: attr.name,
                   value: attr.value,
                   date_created: now,
                   date_modified: now
                });
            }

            await sync_table.addAttributeSync(attr.attribute_id);
        }
    });

    res.send(await sql.getAll("SELECT * FROM attributes WHERE note_id = ? ORDER BY date_created", [noteId]));
}));

module.exports = router;