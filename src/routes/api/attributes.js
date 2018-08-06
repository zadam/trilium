"use strict";

const sql = require('../../services/sql');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');
const Attribute = require('../../entities/attribute');

async function getEffectiveNoteAttributes(req) {
    const noteId = req.params.noteId;

    const attributes = await repository.getEntities(`
        WITH RECURSIVE tree(noteId, level) AS (
        SELECT ?, 0
            UNION
            SELECT branches.parentNoteId, tree.level + 1 FROM branches
            JOIN tree ON branches.noteId = tree.noteId
            JOIN notes ON notes.noteId = branches.parentNoteId
            WHERE notes.isDeleted = 0 AND branches.isDeleted = 0
        )
        SELECT attributes.* FROM attributes JOIN tree ON attributes.noteId = tree.noteId 
        WHERE attributes.isDeleted = 0 AND (attributes.isInheritable = 1 OR attributes.noteId = ?)
        ORDER BY level, noteId, position`, [noteId, noteId]);
        // attributes are ordered so that "closest" attributes are first
        // we order by noteId so that attributes from same note stay together. Actual noteId ordering doesn't matter.

    const filteredAttributes = attributes.filter((attr, index) => {
        if (attr.isDefinition()) {
            const firstDefinitionIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

            // keep only if this element is the first definition for this type & name
            return firstDefinitionIndex === index;
        }
        else {
            const definitionAttr = attributes.find(el => el.type === attr.type + '-definition' && el.name === attr.name);

            if (!definitionAttr) {
                return true;
            }

            const definition = definitionAttr.value;

            if (definition.multiplicityType === 'multivalue') {
                return true;
            }
            else {
                const firstAttrIndex = attributes.findIndex(el => el.type === attr.type && el.name === attr.name);

                // in case of single-valued attribute we'll keep it only if it's first (closest)
                return firstAttrIndex === index;
            }
        }
    });

    return filteredAttributes;
}

async function updateNoteAttribute(req) {
    const noteId = req.params.noteId;
    const body = req.body;

    let attribute;
    if (body.attributeId) {
        attribute = await repository.getAttribute(body.attributeId);
    }
    else {
        attribute = new Attribute();
        attribute.noteId = noteId;
        attribute.name = body.name;
        attribute.type = body.type;
    }

    if (attribute.noteId !== noteId) {
        throw new Error(`Attribute ${body.attributeId} does not belong to note ${noteId}`);
    }

    attribute.value = body.value;

    await attribute.save();

    return {
        attributeId: attribute.attributeId
    };
}

async function deleteNoteAttribute(req) {
    const attributeId = req.params.attributeId;

    const attribute = await repository.getAttribute(attributeId);

    if (attribute) {
        attribute.isDeleted = 1;
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
        attributeEntity.value = attribute.value;
        attributeEntity.position = attribute.position;
        attributeEntity.isInheritable = attribute.isInheritable;
        attributeEntity.isDeleted = attribute.isDeleted;

        console.log("ATTR: ", attributeEntity);

        await attributeEntity.save();
    }

    return await repository.getEntities("SELECT * FROM attributes WHERE isDeleted = 0 AND noteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function getAttributeNames(req) {
    const type = req.query.type;
    const query = req.query.query;

    return attributeService.getAttributeNames(type, query);
}

async function getValuesForAttribute(req) {
    const attributeName = req.params.attributeName;

    return await sql.getColumn("SELECT DISTINCT value FROM attributes WHERE isDeleted = 0 AND name = ? AND value != '' ORDER BY value", [attributeName]);
}

module.exports = {
    updateNoteAttributes,
    updateNoteAttribute,
    deleteNoteAttribute,
    getAttributeNames,
    getValuesForAttribute,
    getEffectiveNoteAttributes
};