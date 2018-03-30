"use strict";

const sql = require('../../services/sql');
const sync_table = require('../../services/sync_table');
const utils = require('../../services/utils');
const labels = require('../../services/labels');

async function getNoteLabels(req) {
    const noteId = req.params.noteId;

    return await sql.getRows("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function updateNoteLabels(req, res, next) {
    const noteId = req.params.noteId;
    const labels = req.body;
    const now = utils.nowDate();

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

    return await sql.getRows("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function getAllLabelNames(req) {
    const names = await sql.getColumn("SELECT DISTINCT name FROM labels WHERE isDeleted = 0");

    for (const attr of labels.BUILTIN_LABELS) {
        if (!names.includes(attr)) {
            names.push(attr);
        }
    }

    names.sort();

    return names;
}

async function getValuesForLabel(req) {
    const labelName = req.params.labelName;

    return await sql.getColumn("SELECT DISTINCT value FROM labels WHERE isDeleted = 0 AND name = ? AND value != '' ORDER BY value", [labelName]);
}

module.exports = {
    getNoteLabels,
    updateNoteLabels,
    getAllLabelNames,
    getValuesForLabel
};