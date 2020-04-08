"use strict";

const repository = require('./repository');
const log = require('./log');
const protectedSessionService = require('./protected_session');
const noteService = require('./notes');
const optionService = require('./options');
const imagemin = require('imagemin');
const imageminMozJpeg = require('imagemin-mozjpeg');
const imageminPngQuant = require('imagemin-pngquant');
const imageminGifLossy = require('imagemin-giflossy');
const jimp = require('jimp');
const imageType = require('image-type');
const sanitizeFilename = require('sanitize-filename');
const noteRevisionService = require('./note_revisions.js');
const isSvg = require('is-svg');

async function processImage(uploadBuffer, originalName, shrinkImageSwitch) {
    const origImageFormat = getImageType(uploadBuffer);

    if (origImageFormat && ["webp", "svg"].includes(origImageFormat.ext)) {
        // JIMP does not support webp at the moment: https://github.com/oliver-moran/jimp/issues/144
        shrinkImageSwitch = false;
    }

    const finalImageBuffer = shrinkImageSwitch ? await shrinkImage(uploadBuffer, originalName) : uploadBuffer;

    const imageFormat = getImageType(finalImageBuffer);

    return {
        buffer: finalImageBuffer,
        imageFormat
    };
}

function getImageType(buffer) {
    if (isSvg(buffer)) {
        return {
            ext: 'svg'
        }
    }
    else {
        return imageType(buffer);
    }
}

function getImageMimeFromExtension(ext) {
    ext = ext.toLowerCase();

    return 'image/' + (ext === 'svg' ? 'svg+xml' : ext);
}

async function updateImage(noteId, uploadBuffer, originalName) {
    log.info(`Updating image ${noteId}: ${originalName}`);

    const {buffer, imageFormat} = await processImage(uploadBuffer, originalName, true);

    const note = await repository.getNote(noteId);

    await noteRevisionService.createNoteRevision(note);

    note.mime = getImageMimeFromExtension(imageFormat.ext);

    await note.setContent(buffer);

    await note.setLabel('originalFileName', originalName);

    await noteRevisionService.protectNoteRevisions(note);
}

async function saveImage(parentNoteId, uploadBuffer, originalName, shrinkImageSwitch) {
    log.info(`Saving image ${originalName}`);

    const {buffer, imageFormat} = await processImage(uploadBuffer, originalName, shrinkImageSwitch);

    const fileName = sanitizeFilename(originalName);

    const parentNote = await repository.getNote(parentNoteId);

    const {note} = await noteService.createNewNote({
        parentNoteId,
        title: fileName,
        content: buffer,
        type: 'image',
        mime: getImageMimeFromExtension(imageFormat.ext),
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
    });

    await note.addLabel('originalFileName', originalName);

    return {
        fileName,
        note,
        noteId: note.noteId,
        url: `api/images/${note.noteId}/${fileName}`
    };
}

async function shrinkImage(buffer, originalName) {
    // we do resizing with max (100) quality which will be trimmed during optimization step next
    const resizedImage = await resize(buffer, 100);
    let finalImageBuffer;

    const jpegQuality = await optionService.getOptionInt('imageJpegQuality');

    try {
        finalImageBuffer = await optimize(resizedImage, jpegQuality);
    } catch (e) {
        log.error("Failed to optimize image '" + originalName + "'\nStack: " + e.stack);
        finalImageBuffer = await resize(buffer, jpegQuality);
    }

    // if resizing & shrinking did not help with size then save the original
    // (can happen when e.g. resizing PNG into JPEG)
    if (finalImageBuffer.byteLength >= buffer.byteLength) {
        finalImageBuffer = buffer;
    }

    return finalImageBuffer;
}

async function resize(buffer, quality) {
    const imageMaxWidthHeight = await optionService.getOptionInt('imageMaxWidthHeight');

    const image = await jimp.read(buffer);

    if (image.bitmap.width > image.bitmap.height && image.bitmap.width > imageMaxWidthHeight) {
        image.resize(imageMaxWidthHeight, jimp.AUTO);
    }
    else if (image.bitmap.height > imageMaxWidthHeight) {
        image.resize(jimp.AUTO, imageMaxWidthHeight);
    }

    image.quality(quality);

    // when converting PNG to JPG we lose alpha channel, this is replaced by white to match Trilium white background
    image.background(0xFFFFFFFF);

    return image.getBufferAsync(jimp.MIME_JPEG);
}

async function optimize(buffer, jpegQuality) {
    return await imagemin.buffer(buffer, {
        plugins: [
            imageminMozJpeg({
                quality: jpegQuality
            }),
            imageminPngQuant({
                quality: [0, 0.7]
            }),
            imageminGifLossy({
                lossy: 80,
                optimize: '3' // needs to be string
            })
        ]
    });
}

module.exports = {
    saveImage,
    updateImage
};