"use strict";

const repository = require('../../services/repository');

async function getNoteRevisions(req) {
    const noteId = req.params.noteId;
    return await repository.getEntities("SELECT * FROM note_revisions WHERE noteId = ? order by utcDateModifiedTo desc", [noteId]);
}

module.exports = {
    getNoteRevisions
};