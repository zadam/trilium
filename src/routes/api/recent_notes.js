"use strict";

const RecentNote = require('../../entities/recent_note');

async function addRecentNote(req) {
    const branchId = req.body.branchId;
    const notePath = req.body.notePath;

    await new RecentNote({
        branchId: branchId,
        notePath: notePath
    }).save();
}

module.exports = {
    addRecentNote
};