"use strict";

const express = require('express');
const router = express.Router();
const rimraf = require('rimraf');
const fs = require('fs');
const sql = require('../../services/sql');
const data_dir = require('../../services/data_dir');
const html = require('html');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;

router.get('/:noteId/to/:directory', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const directory = req.params.directory.replace(/[^0-9a-zA-Z_-]/gi, '');

    if (!fs.existsSync(data_dir.EXPORT_DIR)) {
        fs.mkdirSync(data_dir.EXPORT_DIR);
    }

    const completeExportDir = data_dir.EXPORT_DIR + '/' + directory;

    if (fs.existsSync(completeExportDir)) {
        rimraf.sync(completeExportDir);
    }

    fs.mkdirSync(completeExportDir);

    const noteTreeId = await sql.getValue('SELECT noteTreeId FROM note_tree WHERE noteId = ?', [noteId]);

    await exportNote(noteTreeId, completeExportDir);

    res.send({});
}));

async function exportNote(noteTreeId, dir) {
    const noteTree = await sql.getRow("SELECT * FROM note_tree WHERE noteTreeId = ?", [noteTreeId]);
    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteTree.noteId]);

    const pos = (noteTree.notePosition + '').padStart(4, '0');

    fs.writeFileSync(dir + '/' + pos + '-' + note.title + '.html', html.prettyPrint(note.content, {indent_size: 2}));

    const children = await sql.getRows("SELECT * FROM note_tree WHERE parentNoteId = ? AND isDeleted = 0", [note.noteId]);

    if (children.length > 0) {
        const childrenDir = dir + '/' + pos + '-' + note.title;

        fs.mkdirSync(childrenDir);

        for (const child of children) {
            await exportNote(child.noteTreeId, childrenDir);
        }
    }
}

module.exports = router;