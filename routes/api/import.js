"use strict";

const express = require('express');
const router = express.Router();
const rimraf = require('rimraf');
const fs = require('fs');
const sql = require('../../services/sql');
const data_dir = require('../../services/data_dir');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');

router.get('/:directory/to/:parentNoteId', async (req, res, next) => {
    const directory = req.params.directory.replace(/[^0-9a-zA-Z_-]/gi, '');
    const parentNoteId = req.params.parentNoteId;

    const dir = data_dir.EXPORT_DIR + '/' + directory;

    await sql.doInTransaction(async () => await importNotes(dir, parentNoteId));

    res.send({});
});

async function importNotes(dir, parentNoteId) {
    const parent = await sql.getSingleResult("SELECT * FROM notes WHERE note_id = ?", [parentNoteId]);

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

        const noteTitle = file.substr(0, file.length - 5);
        const noteText = fs.readFileSync(path, "utf8");

        let maxPos = await sql.getSingleValue("SELECT MAX(note_pos) FROM notes_tree WHERE note_pid = ? AND is_deleted = 0", [parentNoteId]);
        if (!maxPos) {
            maxPos = 1;
        }

        const noteId = utils.newNoteId();
        const noteTreeId = utils.newNoteHistoryId();

        await sql.insert('notes_tree', {
            note_tree_id: noteTreeId,
            note_id: noteId,
            note_pid: parentNoteId,
            note_pos: maxPos + 1,
            is_expanded: 0,
            is_deleted: 0,
            date_modified: utils.nowTimestamp()
        });

        await sync_table.addNoteTreeSync(noteTreeId);

        await sql.insert('notes', {
            note_id: noteId,
            note_title: noteTitle,
            note_text: noteText,
            is_deleted: 0,
            is_protected: 0,
            date_created: utils.nowTimestamp(),
            date_modified: utils.nowTimestamp()
        });

        await sync_table.addNoteSync(noteId);

        const noteDir = dir + '/' + noteTitle;

        if (fs.existsSync(noteDir) && fs.lstatSync(noteDir).isDirectory()) {
            await importNotes(noteDir, noteId);
        }
    }
}

module.exports = router;