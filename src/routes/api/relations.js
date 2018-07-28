"use strict";

const sql = require('../../services/sql');
const relationService = require('../../services/relations');
const repository = require('../../services/repository');
const Relation = require('../../entities/relation');

async function getNoteRelations(req) {
    const noteId = req.params.noteId;

    return await repository.getEntities("SELECT * FROM relations WHERE isDeleted = 0 AND sourceNoteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function updateNoteRelations(req) {
    const noteId = req.params.noteId;
    const relations = req.body;

    for (const relation of relations) {
        let relationEntity;

        if (relation.relationId) {
            relationEntity = await repository.getRelation(relation.relationId);
        }
        else {
            // if it was "created" and then immediatelly deleted, we just don't create it at all
            if (relation.isDeleted) {
                continue;
            }

            relationEntity = new Relation();
            relationEntity.sourceNoteId = noteId;
        }

        relationEntity.name = relation.name;
        relationEntity.targetNoteId = relation.targetNoteId;
        relationEntity.position = relation.position;
        relationEntity.isDeleted = relation.isDeleted;

        await relationEntity.save();
    }

    return await repository.getEntities("SELECT * FROM relations WHERE isDeleted = 0 AND sourceNoteId = ? ORDER BY position, dateCreated", [noteId]);
}

async function getAllRelationNames() {
    const names = await sql.getColumn("SELECT DISTINCT name FROM relations WHERE isDeleted = 0");

    for (const relationName of relationService.BUILTIN_RELATIONS) {
        if (!names.includes(relationName)) {
            names.push(relationName);
        }
    }

    names.sort();

    return names;
}

module.exports = {
    getNoteRelations,
    updateNoteRelations,
    getAllRelationNames
};