"use strict";

const RecentNote = require('../../entities/recent_note');

function addRecentNote(req) {
    new RecentNote({
        noteId: req.body.noteId,
        notePath: req.body.notePath
    }).save();
}

module.exports = {
    addRecentNote
};
