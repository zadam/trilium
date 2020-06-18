"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');
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

        if (attribute.noteId !== noteId) {
            return [400, `Attribute ${body.attributeId} is not owned by ${noteId}`];
        }

        if (body.type !== attribute.type
            || body.name !== attribute.name
            || (body.type === 'relation' && body.value !== attribute.value)) {

            if (body.type !== 'relation' || !!body.value.trim()) {
                const newAttribute = attribute.createClone(body.type, body.name, body.value);
                await newAttribute.save();
            }

            attribute.isDeleted = true;
            await attribute.save();

            return {
                attributeId: attribute.attributeId
            };
        }
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

async function updateNoteAttributes2(req) {
    const noteId = req.params.noteId;
    const incomingAttributes = req.body;

    const note = await repository.getNote(noteId);

    let existingAttrs = await note.getAttributes();

    let position = 0;

    for (const incAttr of incomingAttributes) {
        position += 10;

        const perfectMatchAttr = existingAttrs.find(attr =>
            attr.type === incAttr.type &&
            attr.name === incAttr.name &&
            attr.isInheritable === incAttr.isInheritable &&
            attr.value === incAttr.value);

        if (perfectMatchAttr) {
            existingAttrs = existingAttrs.filter(attr => attr.attributeId !== perfectMatchAttr.attributeId);

            if (perfectMatchAttr.position !== position) {
                perfectMatchAttr.position = position;
                await perfectMatchAttr.save();
            }

            continue; // nothing to update
        }

        if (incAttr.type === 'relation') {
            const targetNote = await repository.getNote(incAttr.value);

            if (!targetNote || targetNote.isDeleted) {
                log.error(`Target note of relation ${JSON.stringify(incAttr)} does not exist or is deleted`);
                continue;
            }
        }

        const matchedAttr = existingAttrs.find(attr =>
                attr.type === incAttr.type &&
                attr.name === incAttr.name &&
                attr.isInheritable === incAttr.isInheritable);

        if (matchedAttr) {
            matchedAttr.value = incAttr.value;
            matchedAttr.position = position;
            await matchedAttr.save();

            existingAttrs = existingAttrs.filter(attr => attr.attributeId !== matchedAttr.attributeId);
            continue;
        }

        // no existing attribute has been matched so we need to create a new one
        // type, name and isInheritable are immutable so even if there is an attribute with matching type & name, we need to create a new one and delete the former one

        await note.addAttribute(incAttr.type, incAttr.name, incAttr.value, incAttr.isInheritable, position);
    }

    // all the remaining existing attributes are not defined anymore and should be deleted
    for (const toDeleteAttr of existingAttrs) {
        toDeleteAttr.isDeleted = true;
        await toDeleteAttr.save();
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

            if (attribute.type !== attributeEntity.type
                || attribute.name !== attributeEntity.name
                || (attribute.type === 'relation' && attribute.value !== attributeEntity.value)
                || attribute.isInheritable !== attributeEntity.isInheritable) {

                if (attribute.type !== 'relation' || !!attribute.value.trim()) {
                    const newAttribute = attributeEntity.createClone(attribute.type, attribute.name, attribute.value, attribute.isInheritable);
                    await newAttribute.save();
                }

                attributeEntity.isDeleted = true;
                await attributeEntity.save();

                continue;
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
    note.invalidateAttributeCache();

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

async function getNotesWithAttribute(req) {
    const {type, name, value} = req.body;

    const notes = await attributeService.getNotesWithAttribute(type, name, value);

    return notes.map(note => note.noteId);
}

module.exports = {
    updateNoteAttributes,
    updateNoteAttributes2,
    updateNoteAttribute,
    deleteNoteAttribute,
    getAttributeNames,
    getValuesForAttribute,
    getEffectiveNoteAttributes,
    createRelation,
    deleteRelation,
    getNotesWithAttribute
};
