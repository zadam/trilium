"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const auth = require('../../services/auth');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const multer = require('multer')();
const imagemin = require('imagemin');
const imageminMozJpeg = require('imagemin-mozjpeg');
const imageminPngQuant = require('imagemin-pngquant');
const jimp = require('jimp');
const imageType = require('image-type');
const sanitizeFilename = require('sanitize-filename');

router.get('/:imageId/:filename', auth.checkApiAuth, async (req, res, next) => {
    const image = await sql.getFirst("SELECT * FROM images WHERE image_id = ?", [req.params.imageId]);

    if (!image) {
        return res.status(404).send({});
    }

    res.set('Content-Type', 'image/' + image.format);

    res.send(image.data);
});

router.post('', auth.checkApiAuth, multer.single('upload'), async (req, res, next) => {
    const sourceId = req.headers.source_id;
    const noteId = req.query.noteId;
    const file = req.file;

    const note = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    if (!note) {
        return req.status(404).send(`Note ${noteId} doesn't exist.`);
    }

    if (!["image/png", "image/jpeg"].includes(file.mimetype)) {
        return req.send("Unknown image type: " + file.mimetype);
    }

    const now = utils.nowDate();

    const resizedImage = await resize(file.buffer);
    const optimizedImage = await optimize(resizedImage);

    const imageFormat = imageType(optimizedImage);
    console.log(imageFormat);

    const fileNameWithouExtension = file.originalname.replace(/\.[^/.]+$/, "");
    const fileName = sanitizeFilename(fileNameWithouExtension + "." + imageFormat.ext);

    const imageId = utils.newImageId();

    await sql.doInTransaction(async () => {
        await sql.insert("images", {
            image_id: imageId,
            format: imageFormat.ext,
            name: fileName,
            checksum: utils.hash(optimizedImage),
            data: optimizedImage,
            is_deleted: 0,
            date_modified: now,
            date_created: now
        });

        await sync_table.addImageSync(imageId, sourceId);

        const noteImageId = utils.newNoteImageId();

        await sql.insert("notes_image", {
            note_image_id: noteImageId,
            note_id: noteId,
            image_id: imageId,
            is_deleted: 0,
            date_modified: now,
            date_created: now
        });

        await sync_table.addNoteImageSync(noteImageId, sourceId);
    });

    res.send({
        uploaded: true,
        url: `/api/images/${imageId}/${fileName}`
    });
});

const MAX_SIZE = 1000;
const MAX_BYTE_SIZE = 200000; // images should have under 100 KBs

async function resize(buffer) {
    const image = await jimp.read(buffer);

    if (image.bitmap.width > image.bitmap.height && image.bitmap.width > MAX_SIZE) {
        image.resize(MAX_SIZE, jimp.AUTO);
    }
    else if (image.bitmap.height > MAX_SIZE) {
        image.resize(jimp.AUTO, MAX_SIZE);
    }
    else if (buffer.byteLength <= MAX_BYTE_SIZE) {
        return buffer;
    }

    // we do resizing with max quality which will be trimmed during optimization step next
    image.quality(100);

    // when converting PNG to JPG we lose alpha channel, this is replaced by white to match Trilium white background
    image.background(0xFFFFFFFF);

    // getBuffer doesn't support promises so this workaround
    return await new Promise((resolve, reject) => image.getBuffer(jimp.MIME_JPEG, (err, data) => {
        if (err) {
            reject(err);
        }
        else {
            resolve(data);
        }
    }));
}

async function optimize(buffer) {
    return await imagemin.buffer(buffer, {
        plugins: [
            imageminMozJpeg({
                quality: 50
            }),
            imageminPngQuant({
                quality: "0-70"
            })
        ]
    });
}

module.exports = router;