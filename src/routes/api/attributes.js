"use strict";

const sql = require('../../services/sql');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');
const Attribute = require('../../entities/attribute');

async function getEffectiveNoteAttributes(req) {
    const note = await repository.getNote(req.params.noteId);

    return await note.getAttributes();
}

async function updateNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    let attribute;
    if (body.attributeId) {
        attribute = await repository.getAttribute(body.attributeId);
    }
    else {
        if (body.type === 'relation' && !body.value.trim()) {
            return {};
        }

        attribute = new Attribute();
        attribute.noteId = noteId;
        attribute.name = body.name;
        attribute.type = body.type;
    }

    if (attribute.noteId !== noteId) {
        return [400, `Attribute ${body.attributeId} is not owned by ${noteId}`];
    }

    if (body.value.trim()) {
        attribute.value = body.value;
    }
    else {
        // relations should never have empty target
        attribute.isDeleted = true;
    }

    await attribute.save();

    return {
        attributeId: attribute.attributeId
    };
}

async function deleteNoteAttribute(req) {
    const noteId = req.params.noteId;
    const attributeId = req.params.attributeId;

    const attribute = await repository.getAttribute(attributeId);

    if (attribute) {
        if (attribute.noteId !== noteId) {
            return [400, `Attribute ${attributeId} is not owned by ${noteId}`];
        }

        attribute.isDeleted = true;
        await attribute.save();
    }
}

async function updateNoteAttributes(req) {
    const noteId = req.params.noteId;
    const attributes = req.body;

    for (const attribute of attributes) {
        let attributeEntity;

        if (attribute.attributeId) {
            attributeEntity = await repository.getAttribute(attribute.attributeId);

            if (attributeEntity.noteId !== noteId) {
                return [400, `Attribute ${attributeEntity.noteId} is not owned by ${noteId}`];
            }
        }
        else {
            // if it was "created" and then immediatelly deleted, we just don't create it at all
            if (attribute.isDeleted) {
                continue;
            }

            attributeEntity = new Attribute();
            attributeEntity.noteId = noteId;
        }

        attributeEntity.type = attribute.type;
        attributeEntity.name = attribute.name;
        attributeEntity.position = attribute.position;
        attributeEntity.isInheritable = attribute.isInheritable;
        attributeEntity.isDeleted = attribute.isDeleted;

        if (attributeEntity.type === 'relation' && !attribute.value.trim()) {
            // relation should never have empty target
            attributeEntity.isDeleted = true;
        }
        else {
            attributeEntity.value = attribute.value;
        }

        await attributeEntity.save();
    }

    const note = await repository.getNote(noteId);

    return await note.getAttributes();
}

async function getAttributeNames(req) {
    const type = req.query.type;
    const query = req.query.query;

    return attributeService.getAttributeNames(type, query);
}

async function getValuesForAttribute(req) {
    const attributeName = req.params.attributeName;

    return await sql.getColumn("SELECT DISTINCT value FROM attributes WHERE isDeleted = 0 AND name = ? AND type = 'label' AND value != '' ORDER BY value", [attributeName]);
}

async function createRelation(req) {
    const sourceNoteId = req.params.noteId;
    const targetNoteId = req.params.targetNoteId;
    const name = req.params.name;

    let attribute = await repository.getEntity(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = 'relation' AND name = ? AND value = ?`, [sourceNoteId, name, targetNoteId]);

    if (!attribute) {
        attribute = new Attribute();
        attribute.noteId = sourceNoteId;
        attribute.name = name;
        attribute.type = 'relation';
        attribute.value = targetNoteId;

        await attribute.save();
    }

    return attribute;
}

async function deleteRelation(req) {
    const sourceNoteId = req.params.noteId;
    const targetNoteId = req.params.targetNoteId;
    const name = req.params.name;

    let attribute = await repository.getEntity(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = 'relation' AND name = ? AND value = ?`, [sourceNoteId, name, targetNoteId]);

    if (attribute) {
        attribute.isDeleted = true;
        await attribute.save();
    }
}

module.exports = {
    updateNoteAttributes,
    updateNoteAttribute,
    deleteNoteAttribute,
    getAttributeNames,
    getValuesForAttribute,
    getEffectiveNoteAttributes,
    createRelation,
    deleteRelation
};