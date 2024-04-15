"use strict";

import BRecentNote = require('../../becca/entities/brecent_note');
import sql = require('../../services/sql');
import dateUtils = require('../../services/date_utils');
import { Request } from 'express';

function addRecentNote(req: Request) {
    new BRecentNote({
        noteId: req.body.noteId,
        notePath: req.body.notePath
    }).save();

    if (Math.random() < 0.05) {
        // it's not necessary to run this every time ...
        const cutOffDate = dateUtils.utcDateTimeStr(new Date(Date.now() - 24 * 3600 * 1000));

        sql.execute(`DELETE FROM recent_notes WHERE utcDateCreated < ?`, [cutOffDate]);
    }
}

export = {
    addRecentNote
};
