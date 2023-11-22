"use strict";

const sql = require('../../services/sql.js');
const log = require('../../services/log.js');
const attributeService = require('../../services/attributes.js');
const BAttribute = require('../../becca/entities/battribute.js');
const becca = require('../../becca/becca.js');
const ValidationError = require('../../errors/validation_error.js');

function getEffectiveNoteAttributes(req) {
    const note = becca.getNote(req.params.noteId);

    return note.getAttributes();
}

function updateNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    let attribute;
    if (body.attributeId) {
        attribute = becca.getAttributeOrThrow(body.attributeId);

        if (attribute.noteId !== noteId) {
            throw new ValidationError(`Attribute '${body.attributeId}' is not owned by ${noteId}`);
        }

        if (body.type !== attribute.type
            || body.name !== attribute.name
            || (body.type === 'relation' && body.value !== attribute.value)) {

            let newAttribute;

            if (body.type !== 'relation' || !!body.value.trim()) {
                newAttribute = attribute.createClone(body.type, body.name, body.value);
                newAttribute.save();
            }

            attribute.markAsDeleted();

            return {
                attributeId: newAttribute ? newAttribute.attributeId : null
            };
        }
    }
    else {
        if (body.type === 'relation' && !body.value?.trim()) {
            return {};
        }

        attribute = new BAttribute({
            noteId: noteId,
            name: body.name,
            type: body.type
        });
    }

    if (attribute.type === 'label' || body.value.trim()) {
        attribute.value = body.value;
    }
    else {
        // relations should never have empty target
        attribute.markAsDeleted();
    }

    attribute.save();

    return {
        attributeId: attribute.attributeId
    };
}

function setNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    const attributeId = sql.getValue(`SELECT attributeId FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = ? AND name = ?`, [noteId, body.type, body.name]);

    if (attributeId) {
        const attr = becca.getAttribute(attributeId);
        attr.value = body.value;
        attr.save();
    } else {
        const params = {...body};
        params.noteId = noteId; // noteId must be set before calling constructor for proper initialization

        new BAttribute(params).save();
    }
}

function addNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    new BAttribute({...body, noteId}).save();
}

function deleteNoteAttribute(req) {
    const noteId = req.params.noteId;
    const attributeId = req.params.attributeId;

    const attribute = becca.getAttribute(attributeId);

    if (attribute) {
        if (attribute.noteId !== noteId) {
            throw new ValidationError(`Attribute ${attributeId} is not owned by ${noteId}`);
        }

        attribute.markAsDeleted();
    }
}

function updateNoteAttributes(req) {
    const noteId = req.params.noteId;
    const incomingAttributes = req.body;

    const note = becca.getNote(noteId);

    let existingAttrs = note.getOwnedAttributes().slice();

    let position = 0;

    for (const incAttr of incomingAttributes) {
        position += 10;

        const value = incAttr.value || "";

        const perfectMatchAttr = existingAttrs.find(attr =>
            attr.type === incAttr.type &&
            attr.name === incAttr.name &&
            attr.isInheritable === incAttr.isInheritable &&
            attr.value === value);

        if (perfectMatchAttr) {
            existingAttrs = existingAttrs.filter(attr => attr.attributeId !== perfectMatchAttr.attributeId);

            if (perfectMatchAttr.position !== position) {
                perfectMatchAttr.position = position;
                perfectMatchAttr.save();
            }

            continue; // nothing to update
        }

        if (incAttr.type === 'relation') {
            const targetNote = becca.getNote(incAttr.value);

            if (!targetNote) {
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

        // no existing attribute has been matched, so we need to create a new one
        // type, name and isInheritable are immutable so even if there is an attribute with matching type & name, we need to create a new one and delete the former one

        note.addAttribute(incAttr.type, incAttr.name, incAttr.value, incAttr.isInheritable, position);
    }

    // all the remaining existing attributes are not defined anymore and should be deleted
    for (const toDeleteAttr of existingAttrs) {
        if (!toDeleteAttr.isAutoLink()) {
            toDeleteAttr.markAsDeleted();
        }
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

    const attributeId = sql.getValue(`SELECT attributeId FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = 'relation' AND name = ? AND value = ?`, [sourceNoteId, name, targetNoteId]);
    let attribute = becca.getAttribute(attributeId);

    if (!attribute) {
        attribute = new BAttribute({
            noteId: sourceNoteId,
            name: name,
            type: 'relation',
            value: targetNoteId
        }).save();
    }

    return attribute;
}

function deleteRelation(req) {
    const sourceNoteId = req.params.noteId;
    const targetNoteId = req.params.targetNoteId;
    const name = req.params.name;

    const attributeId = sql.getValue(`SELECT attributeId FROM attributes WHERE isDeleted = 0 AND noteId = ? AND type = 'relation' AND name = ? AND value = ?`, [sourceNoteId, name, targetNoteId]);

    if (attributeId) {
        const attribute = becca.getAttribute(attributeId);
        attribute.markAsDeleted();
    }
}

module.exports = {
    updateNoteAttributes,
    updateNoteAttribute,
    setNoteAttribute,
    addNoteAttribute,
    deleteNoteAttribute,
    getAttributeNames,
    getValuesForAttribute,
    getEffectiveNoteAttributes,
    createRelation,
    deleteRelation
};
