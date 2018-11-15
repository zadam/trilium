"use strict";

const repository = require('./repository');
const protectedSessionService = require('./protected_session');
const noteService = require('./notes');
const imagemin = require('imagemin');
const imageminMozJpeg = require('imagemin-mozjpeg');
const imageminPngQuant = require('imagemin-pngquant');
const imageminGifLossy = require('imagemin-giflossy');
const jimp = require('jimp');
const imageType = require('image-type');
const sanitizeFilename = require('sanitize-filename');

async function saveImage(buffer, originalName, parentNoteId) {
    const resizedImage = await resize(buffer);
    const optimizedImage = await optimize(resizedImage);

    const imageFormat = imageType(optimizedImage);

    const parentNote = await repository.getNote(parentNoteId);

    const fileNameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");
    const fileName = sanitizeFilename(fileNameWithoutExtension + "." + imageFormat.ext);

    const {note} = await noteService.createNote(parentNoteId, fileName, optimizedImage, {
        target: 'into',
        type: 'image',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        mime: 'image/' + imageFormat.ext.toLowerCase(),
        attributes: [
            { type: 'label', name: 'originalFileName', value: originalName },
            { type: 'label', name: 'fileSize', value: optimizedImage.byteLength }
        ]
    });

    return {
        fileName,
        noteId: note.noteId,
        url: `/api/images/${note.noteId}/${fileName}`
    };
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