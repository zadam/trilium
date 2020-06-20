"use strict";

const cloningService = require('../../services/cloning');

function cloneNoteToParent(req) {
    const {noteId, parentBranchId} = req.params;
    const {prefix} = req.body;

    return cloningService.cloneNoteToParent(noteId, parentBranchId, prefix);
}

function cloneNoteAfter(req) {
    const {noteId, afterBranchId} = req.params;

    return cloningService.cloneNoteAfter(noteId, afterBranchId);
}

module.exports = {
    cloneNoteToParent,
    cloneNoteAfter
};
