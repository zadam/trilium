"use strict";

const becca = require('../becca/becca');
const log = require('./log');
const protectedSessionService = require('./protected_session');
const noteService = require('./notes');
const optionService = require('./options');
const sql = require('./sql');
const jimp = require('jimp');
const imageType = require('image-type');
const sanitizeFilename = require('sanitize-filename');
const isSvg = require('is-svg');
const isAnimated = require('is-animated');
const htmlSanitizer = require("./html_sanitizer");

async function processImage(uploadBuffer, originalName, shrinkImageSwitch) {
    const compressImages = optionService.getOptionBool("compressImages");
    const origImageFormat = getImageType(uploadBuffer);

    if (!origImageFormat || !["jpg", "png"].includes(origImageFormat.ext)) {
        shrinkImageSwitch = false;
    }
    else if (isAnimated(uploadBuffer)) {
        // recompression of animated images will make them static
        shrinkImageSwitch = false;
    }

    let finalImageBuffer;
    let imageFormat;

    if (compressImages && shrinkImageSwitch) {
        finalImageBuffer = await shrinkImage(uploadBuffer, originalName);
        imageFormat = getImageType(finalImageBuffer);
    } else {
        finalImageBuffer = uploadBuffer;
        imageFormat = origImageFormat || {
            ext: 'dat'
        };
    }

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
        return imageType(buffer) || {
            ext: "jpg"
        }; // optimistic JPG default
    }
}

function getImageMimeFromExtension(ext) {
    ext = ext.toLowerCase();

    return `image/${ext === 'svg' ? 'svg+xml' : ext}`;
}

function updateImage(noteId, uploadBuffer, originalName) {
    log.info(`Updating image ${noteId}: ${originalName}`);

    originalName = htmlSanitizer.sanitize(originalName);

    const note = becca.getNote(noteId);

    note.saveNoteRevision();

    note.setLabel('originalFileName', originalName);

    // resizing images asynchronously since JIMP does not support sync operation
    processImage(uploadBuffer, originalName, true).then(({buffer, imageFormat}) => {
        sql.transactional(() => {
            note.mime = getImageMimeFromExtension(imageFormat.ext);
            note.save();

            note.setContent(buffer);
        });
    });
}

function saveImage(parentNoteId, uploadBuffer, originalName, shrinkImageSwitch, trimFilename = false) {
    log.info(`Saving image ${originalName} into parent ${parentNoteId}`);

    if (trimFilename && originalName.length > 40) {
        // https://github.com/zadam/trilium/issues/2307
        originalName = "image";
    }

    const fileName = sanitizeFilename(originalName);
    const parentNote = becca.getNote(parentNoteId);

    const {note} = noteService.createNewNote({
        parentNoteId,
        title: fileName,
        type: 'image',
        mime: 'unknown',
        content: '',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
    });

    note.addLabel('originalFileName', originalName);

    // resizing images asynchronously since JIMP does not support sync operation
    processImage(uploadBuffer, originalName, shrinkImageSwitch).then(({buffer, imageFormat}) => {
        sql.transactional(() => {
            note.mime = getImageMimeFromExtension(imageFormat.ext);

            if (!originalName.includes(".")) {
                originalName += `.${imageFormat.ext}`;

                note.setLabel('originalFileName', originalName);
                note.title = sanitizeFilename(originalName);
            }

            note.save();

            note.setContent(buffer);
        });
    });

    return {
        fileName,
        note,
        noteId: note.noteId,
        url: `api/images/${note.noteId}/${fileName}`
    };
}

async function shrinkImage(buffer, originalName) {
    let jpegQuality = optionService.getOptionInt('imageJpegQuality');

    if (jpegQuality < 10 || jpegQuality > 100) {
        jpegQuality = 75;
    }

    let finalImageBuffer;
    try {
        finalImageBuffer = await resize(buffer, jpegQuality);
    }
    catch (e) {
        log.error(`Failed to resize image '${originalName}', stack: ${e.stack}`);

        finalImageBuffer = buffer;
    }

    // if resizing did not help with size then save the original
    // (can happen when e.g. resizing PNG into JPEG)
    if (finalImageBuffer.byteLength >= buffer.byteLength) {
        finalImageBuffer = buffer;
    }

    return finalImageBuffer;
}

async function resize(buffer, quality) {
    const imageMaxWidthHeight = optionService.getOptionInt('imageMaxWidthHeight');

    const start = Date.now();

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

    const resultBuffer = await image.getBufferAsync(jimp.MIME_JPEG);

    log.info(`Resizing image of ${resultBuffer.byteLength} took ${Date.now() - start}ms`);

    return resultBuffer;
}

module.exports = {
    saveImage,
    updateImage
};
