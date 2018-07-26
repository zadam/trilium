"use strict";

const optionService = require('../../services/options');
const RecentNote = require('../../entities/recent_note');

async function addRecentNote(req) {
    const branchId = req.params.branchId;
    const notePath = req.params.notePath;

    await new RecentNote({
        branchId: branchId,
        notePath: notePath
    }).save();

    await optionService.setOption('startNotePath', notePath);
}

module.exports = {
    addRecentNote
};