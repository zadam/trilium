"use strict";

const repository = require('../../services/repository');

async function getLinks(req) {
    const note = await repository.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} not found`];
    }

    return await note.getLinks();
}

async function getIncomingLinks(req) {
    const note = await repository.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} not found`];
    }

    note.getTargetRelations()
}

module.exports = {
    getLinks,
    getIncomingLinks
};