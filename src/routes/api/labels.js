"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const labels = require('../../services/labels');
const repository = require('../../services/repository');
const Label = require('../../entities/label');

async function getNoteLabels(req) {
    const noteId = req.params.noteId;

    return await repository.getEntities("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function updateNoteLabels(req) {
    const noteId = req.params.noteId;
    const labels = req.body;

    for (const label of labels) {
        let labelEntity;

        if (label.labelId) {
            labelEntity = await repository.getLabel(label.labelId);
        }
        else {
            // if it was "created" and then immediatelly deleted, we just don't create it at all
            if (label.isDeleted) {
                continue;
            }

            labelEntity = new Label();
            labelEntity.noteId = noteId;
        }

        labelEntity.name = label.name;
        labelEntity.value = label.value;
        labelEntity.position = label.position;
        labelEntity.isDeleted = label.isDeleted;

        await labelEntity.save();
    }

    return await repository.getEntities("SELECT * FROM labels WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function getAllLabelNames() {
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