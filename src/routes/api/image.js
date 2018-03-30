"use strict";

const sql = require('../../services/sql');
const image = require('../../services/image');
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
const fs = require('fs');

async function returnImage(req, res) {
    const image = await sql.getRow("SELECT * FROM images WHERE imageId = ?", [req.params.imageId]);

    if (!image) {
        return res.sendStatus(404);
    }
    else if (image.data === null) {
        res.set('Content-Type', 'image/png');
        return res.send(fs.readFileSync(RESOURCE_DIR + '/db/image-deleted.png'));
    }

    res.set('Content-Type', 'image/' + image.format);

    res.send(image.data);
}

async function uploadImage(req) {
    const noteId = req.query.noteId;
    const file = req.file;

    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!note) {
        return [404, `Note ${noteId} doesn't exist.`];
    }

    if (!["image/png", "image/jpeg", "image/gif"].includes(file.mimetype)) {
        return [400, "Unknown image type: " + file.mimetype];
    }

    const {fileName, imageId} = await image.saveImage(file, noteId);

    return {
        uploaded: true,
        url: `/api/images/${imageId}/${fileName}`
    };
}

module.exports = {
    returnImage,
    uploadImage
};