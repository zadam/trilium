"use strict";

const imageService = require('../../services/image');
const repository = require('../../services/repository');
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
const fs = require('fs');

async function returnImage(req, res) {
    const image = await repository.getNote(req.params.noteId);

    if (!image) {
        return res.sendStatus(404);
    }
    else if (image.type !== 'image') {
        return res.sendStatus(400);
    }
    else if (image.isDeleted || image.data === null) {
        res.set('Content-Type', 'image/png');
        return res.send(fs.readFileSync(RESOURCE_DIR + '/db/image-deleted.png'));
    }

    res.set('Content-Type', image.mime);

    res.send(await image.getContent());
}

async function uploadImage(req) {
    const noteId = req.query.noteId;
    const file = req.file;

    const note = await repository.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} doesn't exist.`];
    }

    if (!["image/png", "image/jpeg", "image/gif", "image/webp"].includes(file.mimetype)) {
        return [400, "Unknown image type: " + file.mimetype];
    }

    const {url} = await imageService.saveImage(file.buffer, file.originalname, noteId, true);

    return {
        uploaded: true,
        url
    };
}

module.exports = {
    returnImage,
    uploadImage
};