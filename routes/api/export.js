"use strict";

const express = require('express');
const router = express.Router();
const rimraf = require('rimraf');
const fs = require('fs');
const sql = require('../../services/sql');
const data_dir = require('../../services/data_dir');

router.get('/:noteId/to/:directory', async (req, res, next) => {
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

    await exportNote(noteId, completeExportDir);

    res.send({});
});

async function exportNote(noteId, dir) {
    const note = await sql.getSingleResult("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    fs.writeFileSync(dir + '/' + note.note_title + '.html', note.note_text);

    const children = await sql.getResults("SELECT * FROM notes_tree WHERE note_pid = ? AND is_deleted = 0", [noteId]);

    if (children.length > 0) {
        const childrenDir = dir + '/' + note.note_title;

        fs.mkdirSync(childrenDir);

        for (const child of children) {
            await exportNote(child.note_id, childrenDir);
        }
    }
}

module.exports = router;