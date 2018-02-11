"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const image = require('../../services/image');
const multer = require('multer')();
const wrap = require('express-promise-wrap').wrap;
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
const fs = require('fs');

router.get('/:imageId/:filename', auth.checkApiAuthOrElectron, wrap(async (req, res, next) => {
    const image = await sql.getRow("SELECT * FROM images WHERE imageId = ?", [req.params.imageId]);

    if (!image) {
        return res.status(404).send({});
    }
    else if (image.data === null) {
        res.set('Content-Type', 'image/png');
        return res.send(fs.readFileSync(RESOURCE_DIR + '/db/image-deleted.png'));
    }

    res.set('Content-Type', 'image/' + image.format);

    res.send(image.data);
}));

router.post('', auth.checkApiAuthOrElectron, multer.single('upload'), wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;
    const noteId = req.query.noteId;
    const file = req.file;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!note) {
        return res.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (!["image/png", "image/jpeg", "image/gif"].includes(file.mimetype)) {
        return res.status(400).send("Unknown image type: " + file.mimetype);
    }

    const {fileName, imageId} = await image.saveImage(file, sourceId, noteId);

    res.send({
        uploaded: true,
        url: `/api/images/${imageId}/${fileName}`
    });
}));

module.exports = router;