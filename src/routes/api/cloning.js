"use strict";

const cloningService = require('../../services/cloning');

async function cloneNoteToParent(req) {
    const {noteId, parentBranchId} = req.params;
    const {prefix} = req.body;

    return await cloningService.cloneNoteToParent(noteId, parentBranchId, prefix);
}

async function cloneNoteAfter(req) {
    const {noteId, afterBranchId} = req.params;

    return await cloningService.cloneNoteAfter(noteId, afterBranchId);
}

module.exports = {
    cloneNoteToParent,
    cloneNoteAfter
};
