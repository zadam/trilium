"use strict";

const optionService = require('../../services/options');
const RecentNote = require('../../entities/recent_note');

async function addRecentNote(req) {
    const branchId = req.body.branchId;
    const notePath = req.body.notePath;

    await new RecentNote({
        branchId: branchId,
        notePath: notePath
    }).save();

    await optionService.setOption('startNotePath', notePath);
}

module.exports = {
    addRecentNote
};