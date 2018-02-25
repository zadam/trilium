"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const attributes = require('../../services/attributes');
const html = require('html');
const auth = require('../../services/auth');
const wrap = require('express-promise-wrap').wrap;
const tar = require('tar-stream');
const sanitize = require("sanitize-filename");

router.get('/:noteId/', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const noteTreeId = await sql.getValue('SELECT noteTreeId FROM note_tree WHERE noteId = ?', [noteId]);

    const pack = tar.pack();

    const name = await exportNote(noteTreeId, '', pack);

    pack.finalize();

    res.setHeader('Content-Disposition', 'attachment; filename="' + name + '.tar"');
    res.setHeader('Content-Type', 'application/tar');

    pack.pipe(res);
}));

async function exportNote(noteTreeId, directory, pack) {
    const noteTree = await sql.getRow("SELECT * FROM note_tree WHERE noteTreeId = ?", [noteTreeId]);
    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteTree.noteId]);

    const content = note.type === 'text' ? html.prettyPrint(note.content, {indent_size: 2}) : note.content;

    const childFileName = directory + sanitize(note.title);

    console.log(childFileName);

    pack.entry({ name: childFileName + ".dat", size: content.length }, content);

    const metadata = await getMetadata(note);

    pack.entry({ name: childFileName + ".meta", size: metadata.length }, metadata);

    const children = await sql.getRows("SELECT * FROM note_tree WHERE parentNoteId = ? AND isDeleted = 0", [note.noteId]);

    if (children.length > 0) {
        for (const child of children) {
            await exportNote(child.noteTreeId, childFileName + "/", pack);
        }
    }

    return childFileName;
}

async function getMetadata(note) {
    const meta = {
        title: note.title,
        type: note.type,
        mime: note.mime,
        attributes: await attributes.getNoteAttributeMap(note.noteId)
    };

    return JSON.stringify(meta, null, '\t')
}

module.exports = router;