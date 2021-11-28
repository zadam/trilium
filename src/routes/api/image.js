"use strict";

const imageService = require('../../services/image');
const becca = require('../../becca/becca');
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
const fs = require('fs');

function returnImage(req, res) {
    const image = becca.getNote(req.params.noteId);

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
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");

    res.send(image.getContent());
}

function uploadImage(req) {
    const {noteId} = req.query;
    const {file} = req;

    const note = becca.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} doesn't exist.`];
    }

    if (!["image/png", "image/jpg", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return [400, "Unknown image type: " + file.mimetype];
    }

    const {url} = imageService.saveImage(noteId, file.buffer, file.originalname, true, true);

    return {
        uploaded: true,
        url
    };
}

function updateImage(req) {
    const {noteId} = req.params;
    const {file} = req;

    const note = becca.getNote(noteId);

    if (!note) {
        return [404, `Note ${noteId} doesn't exist.`];
    }

    if (!["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"].includes(file.mimetype)) {
        return {
            uploaded: false,
            message: "Unknown image type: " + file.mimetype
        };
    }

    imageService.updateImage(noteId, file.buffer, file.originalname);

    return { uploaded: true };
}

module.exports = {
    returnImage,
    uploadImage,
    updateImage
};
