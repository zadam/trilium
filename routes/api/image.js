"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const multer = require('multer')();

router.get('/:imageId/:filename', auth.checkApiAuth, async (req, res, next) => {
    const image = await sql.getFirst("SELECT * FROM images WHERE image_id = ?", [req.params.imageId]);

    if (!image) {
        return res.status(404).send({});
    }

    res.set('Content-Type', 'image/' + image.format);

    res.send(image.data);
});

router.post('/upload', auth.checkApiAuth, multer.single('upload'), async (req, res, next) => {
    const file = req.file;
    console.log("File: ", file);

    const imageId = utils.newNoteId();

    if (!file.mimetype.startsWith("image/")) {
        return req.send("Unknown image type: " + file.mimetype);
    }

    const now = utils.nowDate();

    await sql.insert("images", {
        image_id: imageId,
        format: file.mimetype.substr(6),
        name: file.originalname,
        checksum: utils.hash(file.buffer),
        data: file.buffer,
        is_deleted: 0,
        date_modified: now,
        date_created: now
    });

    res.send({
        uploaded: true,
        url: `/api/image/${imageId}/${file.originalname}`
    });
});

module.exports = router;