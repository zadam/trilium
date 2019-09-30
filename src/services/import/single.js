"use strict";

const noteService = require('../../services/notes');
const imageService = require('../../services/image');
const protectedSessionService = require('../protected_session');
const commonmark = require('commonmark');
const path = require('path');
const mimeService = require('./mime');

async function importSingleFile(importContext, file, parentNote) {
    const mime = mimeService.getMime(file.originalname);

    if (importContext.textImportedAsText) {
        if (mime === 'text/html') {
            return await importHtml(importContext, file, parentNote);
        } else if (['text/markdown', 'text/x-markdown'].includes(mime)) {
            return await importMarkdown(importContext, file, parentNote);
        } else if (mime === 'text/plain') {
            return await importPlainText(importContext, file, parentNote);
        }
    }

    if (importContext.codeImportedAsCode && mimeService.getType(importContext, mime) === 'code') {
        return await importCodeNote(importContext, file, parentNote);
    }

    if (["image/jpeg", "image/gif", "image/png", "image/webp"].includes(mime)) {
        return await importImage(file, parentNote, importContext);
    }

    return await importFile(importContext, file, parentNote);
}

async function importImage(file, parentNote, importContext) {
    const {note} = await imageService.saveImage(file.buffer, file.originalname, parentNote.noteId, importContext.shrinkImages);

    importContext.increaseProgressCount();

    return note;
}

async function importFile(importContext, file, parentNote) {
    const originalName = file.originalname;
    const size = file.size;

    const {note} = await noteService.createNote(parentNote.noteId, originalName, file.buffer, {
        target: 'into',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        type: 'file',
        mime: mimeService.getMime(originalName),
        attributes: [
            { type: "label", name: "originalFileName", value: originalName },
            { type: "label", name: "fileSize", value: size }
        ]
    });

    importContext.increaseProgressCount();

    return note;
}

async function importCodeNote(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");
    const detectedMime = mimeService.getMime(file.originalname);
    const mime = mimeService.normalizeMimeType(detectedMime);

    const {note} = await noteService.createNote(parentNote.noteId, title, content, {
        type: 'code',
        mime: mime,
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
    });

    importContext.increaseProgressCount();

    return note;
}

async function importPlainText(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const plainTextContent = file.buffer.toString("UTF-8");
    const htmlContent = convertTextToHtml(plainTextContent);

    const {note} = await noteService.createNote(parentNote.noteId, title, htmlContent, {
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    importContext.increaseProgressCount();

    return note;
}

function convertTextToHtml(text) {
    // 1: Plain Text Search
    text = text.replace(/&/g, "&amp;").
    replace(/</g, "&lt;").
    replace(/>/g, "&gt;");

    // 2: Line Breaks
    text = text.replace(/\r\n?|\n/g, "<br>");

    // 3: Paragraphs
    text = text.replace(/<br>\s*<br>/g, "</p><p>");

    // 4: Wrap in Paragraph Tags
    text = "<p>" + text + "</p>";

    return text;
}

async function importMarkdown(importContext, file, parentNote) {
    const markdownContent = file.buffer.toString("UTF-8");

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();

    const parsed = reader.parse(markdownContent);
    const htmlContent = writer.render(parsed);

    const title = getFileNameWithoutExtension(file.originalname);

    const {note} = await noteService.createNote(parentNote.noteId, title, htmlContent, {
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    importContext.increaseProgressCount();

    return note;
}

async function importHtml(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");

    const {note} = await noteService.createNote(parentNote.noteId, title, content, {
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    importContext.increaseProgressCount();

    return note;
}

function getFileNameWithoutExtension(filePath) {
    const extension = path.extname(filePath);

    return filePath.substr(0, filePath.length - extension.length);
}

module.exports = {
    importSingleFile
};