"use strict";

const cloningService = require('../../services/cloning');

async function cloneNoteToParent(req) {
    const noteId = req.params.noteId;
    const parentNoteId = req.params.parentNoteId;
    const prefix = req.body.prefix;

    return await cloningService.cloneNoteToParent(noteId, parentNoteId, prefix);
}

async function cloneNoteAfter(req) {
    const noteId = req.params.noteId;
    const afterBranchId = req.params.afterBranchId;

    return await cloningService.cloneNoteAfter(noteId, afterBranchId);
}

module.exports = {
    cloneNoteToParent,
    cloneNoteAfter
};