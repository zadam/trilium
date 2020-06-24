"use strict";

const noteService = require('../../services/notes');
const imageService = require('../../services/image');
const protectedSessionService = require('../protected_session');
const commonmark = require('commonmark');
const path = require('path');
const mimeService = require('./mime');

async function importSingleFile(taskContext, file, parentNote) {
    const mime = mimeService.getMime(file.originalname) || file.mimetype;

    if (taskContext.data.textImportedAsText) {
        if (mime === 'text/html') {
            return await importHtml(taskContext, file, parentNote);
        } else if (['text/markdown', 'text/x-markdown'].includes(mime)) {
            return await importMarkdown(taskContext, file, parentNote);
        } else if (mime === 'text/plain') {
            return await importPlainText(taskContext, file, parentNote);
        }
    }

    if (taskContext.data.codeImportedAsCode && mimeService.getType(taskContext.data, mime) === 'code') {
        return await importCodeNote(taskContext, file, parentNote);
    }

    if (mime.startsWith("image/")) {
        return await importImage(file, parentNote, taskContext);
    }

    return await importFile(taskContext, file, parentNote);
}

async function importImage(file, parentNote, taskContext) {
    const {note} = await imageService.saveImage(parentNote.noteId, file.buffer, file.originalname, taskContext.data.shrinkImages);

    taskContext.increaseProgressCount();

    return note;
}

async function importFile(taskContext, file, parentNote) {
    const originalName = file.originalname;

    const {note} = await noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title: originalName,
        content: file.buffer,
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        type: 'file',
        mime: mimeService.getMime(originalName) || file.mimetype
    });

    await note.addLabel("originalFileName", originalName);

    taskContext.increaseProgressCount();

    return note;
}

async function importCodeNote(taskContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");
    const detectedMime = mimeService.getMime(file.originalname) || file.mimetype;
    const mime = mimeService.normalizeMimeType(detectedMime);

    const {note} = await noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title,
        content,
        type: 'code',
        mime: mime,
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
    });

    taskContext.increaseProgressCount();

    return note;
}

async function importPlainText(taskContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const plainTextContent = file.buffer.toString("UTF-8");
    const htmlContent = convertTextToHtml(plainTextContent);

    const {note} = await noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title,
        content: htmlContent,
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    taskContext.increaseProgressCount();

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

async function importMarkdown(taskContext, file, parentNote) {
    const markdownContent = file.buffer.toString("UTF-8");

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();

    const parsed = reader.parse(markdownContent);
    const htmlContent = writer.render(parsed);

    const title = getFileNameWithoutExtension(file.originalname);

    const {note} = await noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title,
        content: htmlContent,
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    taskContext.increaseProgressCount();

    return note;
}

async function importHtml(taskContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");

    const {note} = await noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title,
        content,
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    taskContext.increaseProgressCount();

    return note;
}

function getFileNameWithoutExtension(filePath) {
    const extension = path.extname(filePath);

    return filePath.substr(0, filePath.length - extension.length);
}

module.exports = {
    importSingleFile
};
