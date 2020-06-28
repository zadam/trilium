"use strict";

const repository = require('./repository');
const log = require('./log');
const protectedSessionService = require('./protected_session');
const noteService = require('./notes');
const optionService = require('./options');
const jimp = require('jimp');
const imageType = require('image-type');
const sanitizeFilename = require('sanitize-filename');
const noteRevisionService = require('./note_revisions.js');
const isSvg = require('is-svg');

function processImage(uploadBuffer, originalName, shrinkImageSwitch) {
    const origImageFormat = getImageType(uploadBuffer);

    if (origImageFormat && ["webp", "svg"].includes(origImageFormat.ext)) {
        // JIMP does not support webp at the moment: https://github.com/oliver-moran/jimp/issues/144
        shrinkImageSwitch = false;
    }

    const finalImageBuffer = shrinkImageSwitch ? shrinkImage(uploadBuffer) : uploadBuffer;

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

function updateImage(noteId, uploadBuffer, originalName) {
    log.info(`Updating image ${noteId}: ${originalName}`);

    const {buffer, imageFormat} = processImage(uploadBuffer, originalName, true);

    const note = repository.getNote(noteId);

    noteRevisionService.createNoteRevision(note);

    note.mime = getImageMimeFromExtension(imageFormat.ext);

    note.setContent(buffer);

    note.setLabel('originalFileName', originalName);

    noteRevisionService.protectNoteRevisions(note);
}

function saveImage(parentNoteId, uploadBuffer, originalName, shrinkImageSwitch) {
    log.info(`Saving image ${originalName}`);

    const {buffer, imageFormat} = processImage(uploadBuffer, originalName, shrinkImageSwitch);

    const fileName = sanitizeFilename(originalName);

    const parentNote = repository.getNote(parentNoteId);

    const {note} = noteService.createNewNote({
        parentNoteId,
        title: fileName,
        content: buffer,
        type: 'image',
        mime: getImageMimeFromExtension(imageFormat.ext),
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
    });

    note.addLabel('originalFileName', originalName);

    return {
        fileName,
        note,
        noteId: note.noteId,
        url: `api/images/${note.noteId}/${fileName}`
    };
}

function shrinkImage(buffer) {
    const jpegQuality = optionService.getOptionInt('imageJpegQuality');
    let finalImageBuffer = resize(buffer, jpegQuality);

    // if resizing & shrinking did not help with size then save the original
    // (can happen when e.g. resizing PNG into JPEG)
    if (finalImageBuffer.byteLength >= buffer.byteLength) {
        finalImageBuffer = buffer;
    }

    return finalImageBuffer;
}

function resize(buffer, quality) {
    const imageMaxWidthHeight = optionService.getOptionInt('imageMaxWidthHeight');

    const image = jimp.read(buffer);

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

module.exports = {
    saveImage,
    updateImage
};
