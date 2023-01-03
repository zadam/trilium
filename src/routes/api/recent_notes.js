"use strict";

const BRecentNote = require('../../becca/entities/brecent_note');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');

function addRecentNote(req) {
    new BRecentNote({
        noteId: req.body.noteId,
        notePath: req.body.notePath
    }).save();

    if (Math.random() < 0.05) {
        // it's not necessary to run this everytime ...
        const cutOffDate = dateUtils.utcDateTimeStr(new Date(Date.now() - 24 * 3600 * 1000));

        sql.execute(`DELETE FROM recent_notes WHERE utcDateCreated < ?`, [cutOffDate]);
    }
}

module.exports = {
    addRecentNote
};
