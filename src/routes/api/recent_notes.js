"use strict";

const RecentNote = require('../../entities/recent_note');

async function addRecentNote(req) {
    await new RecentNote({
        noteId: req.body.noteId,
        notePath: req.body.notePath
    }).save();
}

module.exports = {
    addRecentNote
};