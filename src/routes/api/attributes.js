"use strict";

const sql = require('../../services/sql');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');
const Attribute = require('../../entities/attribute');

async function getNoteAttributes(req) {
    const noteId = req.params.noteId;

    return await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function updateNoteAttributes(req) {
    const noteId = req.params.noteId;
    const attributes = req.body;

    for (const attribute of attributes) {
        let attributeEntity;

        if (attribute.attributeId) {
            attributeEntity = await repository.getAttribute(attribute.attributeId);
        }
        else {
            // if it was "created" and then immediatelly deleted, we just don't create it at all
            if (attribute.isDeleted) {
                continue;
            }

            attributeEntity = new Attribute();
            attributeEntity.noteId = noteId;
        }

        attributeEntity.name = attribute.name;
        attributeEntity.value = attribute.value;
        attributeEntity.position = attribute.position;
        attributeEntity.isDeleted = attribute.isDeleted;

        await attributeEntity.save();
    }

    return await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function getAllAttributeNames() {
    const names = await sql.getColumn("SELECT DISTINCT name FROM attributes WHERE isDeleted = 0");

    for (const attribute of attributeService.BUILTIN_ATTRIBUTES) {
        if (!names.includes(attribute)) {
            names.push(attribute);
        }
    }

    names.sort();

    return names;
}

async function getValuesForAttribute(req) {
    const attributeName = req.params.attributeName;

    return await sql.getColumn("SELECT DISTINCT value FROM attributes WHERE isDeleted = 0 AND name = ? AND value != '' ORDER BY value", [attributeName]);
}

module.exports = {
    getNoteAttributes,
    updateNoteAttributes,
    getAllAttributeNames,
    getValuesForAttribute
};