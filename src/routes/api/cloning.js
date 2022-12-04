"use strict";

const cloningService = require('../../services/cloning');

function cloneNoteToBranch(req) {
    const {noteId, parentBranchId} = req.params;
    const {prefix} = req.body;

    return cloningService.cloneNoteToBranch(noteId, parentBranchId, prefix);
}

function cloneNoteToNote(req) {
    const {noteId, parentNoteId} = req.params;
    const {prefix} = req.body;

    return cloningService.cloneNoteToNote(noteId, parentNoteId, prefix);
}

function cloneNoteAfter(req) {
    const {noteId, afterBranchId} = req.params;

    return cloningService.cloneNoteAfter(noteId, afterBranchId);
}

function toggleNoteInParent(req) {
    const {noteId, parentNoteId, present} = req.params;

    return cloningService.toggleNoteInParent(present === 'true', noteId, parentNoteId);
}

module.exports = {
    cloneNoteToBranch,
    cloneNoteToNote,
    cloneNoteAfter,
    toggleNoteInParent
};
