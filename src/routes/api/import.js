"use strict";

const express = require('express');
const router = express.Router();
const fs = require('fs');
const sql = require('../../services/sql');
const data_dir = require('../../services/data_dir');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.get('/:directory/to/:parentNoteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const directory = req.params.directory.replace(/[^0-9a-zA-Z_-]/gi, '');
    const parentNoteId = req.params.parentNoteId;

    const dir = data_dir.EXPORT_DIR + '/' + directory;

    await sql.doInTransaction(async () => await importNotes(dir, parentNoteId));

    res.send({});
}));

async function importNotes(dir, parentNoteId) {
    const parent = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

    if (!parent) {
        return;
    }

    const fileList = fs.readdirSync(dir);

    for (const file of fileList) {
        const path = dir + '/' + file;

        if (fs.lstatSync(path).isDirectory()) {
            continue;
        }

        if (!file.endsWith('.html')) {
            continue;
        }

        const fileNameWithoutExt = file.substr(0, file.length - 5);

        let noteTitle;
        let notePos;

        const match = fileNameWithoutExt.match(/^([0-9]{4})-(.*)$/);
        if (match) {
            notePos = parseInt(match[1]);
            noteTitle = match[2];
        }
        else {
            let maxPos = await sql.getValue("SELECT MAX(notePosition) FROM note_tree WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId]);
            if (maxPos) {
                notePos = maxPos + 1;
            }
            else {
                notePos = 0;
            }

            noteTitle = fileNameWithoutExt;
        }

        const noteText = fs.readFileSync(path, "utf8");

        const noteId = utils.newNoteId();
        const noteTreeId = utils.newnoteRevisionId();

        const now = utils.nowDate();

        await sql.insert('note_tree', {
            noteTreeId: noteTreeId,
            noteId: noteId,
            parentNoteId: parentNoteId,
            notePosition: notePos,
            isExpanded: 0,
            isDeleted: 0,
            dateModified: now
        });

        await sync_table.addNoteTreeSync(noteTreeId);

        await sql.insert('notes', {
            noteId: noteId,
            title: noteTitle,
            content: noteText,
            isDeleted: 0,
            isProtected: 0,
            type: 'text',
            mime: 'text/html',
            dateCreated: now,
            dateModified: now
        });

        await sync_table.addNoteSync(noteId);

        const noteDir = dir + '/' + fileNameWithoutExt;

        if (fs.existsSync(noteDir) && fs.lstatSync(noteDir).isDirectory()) {
            await importNotes(noteDir, noteId);
        }
    }
}

module.exports = router;