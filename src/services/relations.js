"use strict";

const repository = require('./repository');
const Relation = require('../entities/relation');

const BUILTIN_RELATIONS = [
    'exampleBuiltIn'
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

module.exports = {
    getNotesWithRelation,
    getNoteWithRelation,
    createRelation,
    BUILTIN_RELATIONS
};