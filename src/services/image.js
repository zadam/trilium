"use strict";

const utils = require('./utils');
const sql = require('./sql');
const sync_table = require('./sync_table');
const imagemin = require('imagemin');
const imageminMozJpeg = require('imagemin-mozjpeg');
const imageminPngQuant = require('imagemin-pngquant');
const imageminGifLossy = require('imagemin-giflossy');
const jimp = require('jimp');
const imageType = require('image-type');
const sanitizeFilename = require('sanitize-filename');

async function saveImage(file, noteId) {
    const resizedImage = await resize(file.buffer);
    const optimizedImage = await optimize(resizedImage);

    const imageFormat = imageType(optimizedImage);

    const fileNameWithouExtension = file.originalname.replace(/\.[^/.]+$/, "");
    const fileName = sanitizeFilename(fileNameWithouExtension + "." + imageFormat.ext);

    const imageId = utils.newImageId();
    const now = utils.nowDate();

    await sql.doInTransaction(async () => {
        await sql.insert("images", {
            imageId: imageId,
            format: imageFormat.ext,
            name: fileName,
            checksum: utils.hash(optimizedImage),
            data: optimizedImage,
            isDeleted: 0,
            dateModified: now,
            dateCreated: now
        });

        await sync_table.addImageSync(imageId);

        const noteImageId = utils.newNoteImageId();

        await sql.insert("note_images", {
            noteImageId: noteImageId,
            noteId: noteId,
            imageId: imageId,
            isDeleted: 0,
            dateModified: now,
            dateCreated: now
        });

        await sync_table.addNoteImageSync(noteImageId);
    });
    return {fileName, imageId};
}

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
            }),
            imageminGifLossy({
                lossy: 80,
                optimize: '3' // needs to be string
            })
        ]
    });
}

module.exports = {
    saveImage
};