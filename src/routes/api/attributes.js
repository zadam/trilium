"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');
const Attribute = require('../../entities/attribute');

function getEffectiveNoteAttributes(req) {
    const note = repository.getNote(req.params.noteId);

    return note.getAttributes();
}

function updateNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    let attribute;
    if (body.attributeId) {
        attribute = repository.getAttribute(body.attributeId);

        if (attribute.noteId !== noteId) {
            return [400, `Attribute ${body.attributeId} is not owned by ${noteId}`];
        }

        if (body.type !== attribute.type
            || body.name !== attribute.name
            || (body.type === 'relation' && body.value !== attribute.value)) {

            if (body.type !== 'relation' || !!body.value.trim()) {
                const newAttribute = attribute.createClone(body.type, body.name, body.value);
                newAttribute.save();
            }

            attribute.isDeleted = true;
            attribute.save();

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

    if (attribute.type === 'label' || body.value.trim()) {
        attribute.value = body.value;
    }
    else {
        // relations should never have empty target
        attribute.isDeleted = true;
    }

    attribute.save();

    return {
        attributeId: attribute.attributeId
    };
}

function setNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    let attr = repository.getEntity(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = ? AND name = ?`, [noteId, body.type, body.name]);

    if (attr) {
        attr.value = body.value;
    } else {
        attr = new Attribute(body);
        attr.noteId = noteId;
    }

    attr.save();
}

function deleteNoteAttribute(req) {
    const noteId = req.params.noteId;
    const attributeId = req.params.attributeId;

    const attribute = repository.getAttribute(attributeId);

    if (attribute) {
        if (attribute.noteId !== noteId) {
            return [400, `Attribute ${attributeId} is not owned by ${noteId}`];
        }

        attribute.isDeleted = true;
        attribute.save();
    }
}

function updateNoteAttributes(req) {
    const noteId = req.params.noteId;
    const incomingAttributes = req.body;

    const note = repository.getNote(noteId);

    let existingAttrs = note.getOwnedAttributes();

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
                perfectMatchAttr.save();
            }

            continue; // nothing to update
        }

        if (incAttr.type === 'relation') {
            const targetNote = repository.getNote(incAttr.value);

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
            matchedAttr.save();

            existingAttrs = existingAttrs.filter(attr => attr.attributeId !== matchedAttr.attributeId);
            continue;
        }

        // no existing attribute has been matched so we need to create a new one
        // type, name and isInheritable are immutable so even if there is an attribute with matching type & name, we need to create a new one and delete the former one

        note.addAttribute(incAttr.type, incAttr.name, incAttr.value, incAttr.isInheritable, position);
    }

    // all the remaining existing attributes are not defined anymore and should be deleted
    for (const toDeleteAttr of existingAttrs) {
        toDeleteAttr.isDeleted = true;
        toDeleteAttr.save();
    }
}

function getAttributeNames(req) {
    const type = req.query.type;
    const query = req.query.query;

    return attributeService.getAttributeNames(type, query);
}

function getValuesForAttribute(req) {
    const attributeName = req.params.attributeName;

    return sql.getColumn("SELECT DISTINCT value FROM attributes WHERE isDeleted = 0 AND name = ? AND type = 'label' AND value != '' ORDER BY value", [attributeName]);
}

function createRelation(req) {
    const sourceNoteId = req.params.noteId;
    const targetNoteId = req.params.targetNoteId;
    const name = req.params.name;

    let attribute = repository.getEntity(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = 'relation' AND name = ? AND value = ?`, [sourceNoteId, name, targetNoteId]);

    if (!attribute) {
        attribute = new Attribute();
        attribute.noteId = sourceNoteId;
        attribute.name = name;
        attribute.type = 'relation';
        attribute.value = targetNoteId;

        attribute.save();
    }

    return attribute;
}

function deleteRelation(req) {
    const sourceNoteId = req.params.noteId;
    const targetNoteId = req.params.targetNoteId;
    const name = req.params.name;

    let attribute = repository.getEntity(`SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = 'relation' AND name = ? AND value = ?`, [sourceNoteId, name, targetNoteId]);

    if (attribute) {
        attribute.isDeleted = true;
        attribute.save();
    }
}

module.exports = {
    updateNoteAttributes,
    updateNoteAttribute,
    setNoteAttribute,
    deleteNoteAttribute,
    getAttributeNames,
    getValuesForAttribute,
    getEffectiveNoteAttributes,
    createRelation,
    deleteRelation
};
