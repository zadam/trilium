"use strict";

const repository = require('./repository');
const Relation = require('../entities/relation');

const BUILTIN_RELATIONS = [
    'runOnNoteView',
    'runOnNoteTitleChange'
];

async function getNotesWithRelation(name, targetNoteId) {
    let notes;

    if (targetNoteId !== undefined) {
        notes = await repository.getEntities(`SELECT notes.* FROM notes JOIN relations ON notes.noteId = relations.sourceNoteId
          WHERE notes.isDeleted = 0 AND relations.isDeleted = 0 AND relations.name = ? AND relations.targetNoteId = ?`, [name, targetNoteId]);
    }
    else {
        notes = await repository.getEntities(`SELECT notes.* FROM notes JOIN relations ON notes.noteId = relations.sourceNoteId 
          WHERE notes.isDeleted = 0 AND relations.isDeleted = 0 AND relations.name = ?`, [name]);
    }

    return notes;
}

async function getNoteWithRelation(name, value) {
    const notes = await getNotesWithRelation(name, value);

    return notes.length > 0 ? notes[0] : null;
}

async function createRelation(sourceNoteId, name, targetNoteId) {
    return await new Relation({
        sourceNoteId: sourceNoteId,
        name: name,
        targetNoteId: targetNoteId
    }).save();
}

async function getEffectiveRelations(noteId, relationName) {
    const relations = await repository.getEntities(`
        WITH RECURSIVE tree(noteId) AS (
        SELECT ?
            UNION
            SELECT branches.parentNoteId FROM branches
            JOIN tree ON branches.noteId = tree.noteId
            JOIN notes ON notes.noteId = branches.parentNoteId
            WHERE notes.isDeleted = 0 AND branches.isDeleted = 0
        )
        SELECT relations.* FROM relations JOIN tree ON relations.sourceNoteId = tree.noteId 
        WHERE relations.isDeleted = 0 AND (relations.isInheritable = 1 OR relations.sourceNoteId = ?)`, [noteId, noteId]);

    if (relationName) {
        return relations.filter(relation => relation.name === relationName);
    }
    else {
        return relations;
    }
}

module.exports = {
    BUILTIN_RELATIONS,
    getNotesWithRelation,
    getNoteWithRelation,
    createRelation,
    getEffectiveRelations
};