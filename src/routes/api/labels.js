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

    for (const label of labels) {
        if (label.labelId) {
            await sql.execute("UPDATE labels SET name = ?, value = ?, dateModified = ?, isDeleted = ?, position = ? WHERE labelId = ?",
                [label.name, label.value, now, label.isDeleted, label.position, label.labelId]);
        }
        else {
            // if it was "created" and then immediatelly deleted, we just don't create it at all
            if (label.isDeleted) {
                continue;
            }

            label.labelId = utils.newLabelId();

            await sql.insert("labels", {
                labelId: label.labelId,
                noteId: noteId,
                name: label.name,
                value: label.value,
                position: label.position,
                dateCreated: now,
                dateModified: now,
                isDeleted: false
            });
        }

        await sync_table.addLabelSync(label.labelId);
    }

    return await sql.getRows("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function getAllLabelNames(req) {
    const names = await sql.getColumn("SELECT DISTINCT name FROM labels WHERE isDeleted = 0");

    for (const label of labels.BUILTIN_LABELS) {
        if (!names.includes(label)) {
            names.push(label);
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