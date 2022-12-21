"use strict";

const noteService = require('../../services/notes');
const imageService = require('../../services/image');
const protectedSessionService = require('../protected_session');
const commonmark = require('commonmark');
const mimeService = require('./mime');
const utils = require('../../services/utils');
const htmlSanitizer = require('../html_sanitizer');

function importSingleFile(taskContext, file, parentNote) {
    const mime = mimeService.getMime(file.originalname) || file.mimetype;

    if (taskContext.data.textImportedAsText) {
        if (mime === 'text/html') {
            return importHtml(taskContext, file, parentNote);
        } else if (['text/markdown', 'text/x-markdown'].includes(mime)) {
            return importMarkdown(taskContext, file, parentNote);
        } else if (mime === 'text/plain') {
            return importPlainText(taskContext, file, parentNote);
        }
    }

    if (taskContext.data.codeImportedAsCode && mimeService.getType(taskContext.data, mime) === 'code') {
        return importCodeNote(taskContext, file, parentNote);
    }

    if (mime.startsWith("image/")) {
        return importImage(file, parentNote, taskContext);
    }

    return importFile(taskContext, file, parentNote);
}

function importImage(file, parentNote, taskContext) {
    const {note} = imageService.saveImage(parentNote.noteId, file.buffer, file.originalname, taskContext.data.shrinkImages);

    taskContext.increaseProgressCount();

    return note;
}

function importFile(taskContext, file, parentNote) {
    const originalName = file.originalname;

    const {note} = noteService.createNewNote({
        parentNoteId: parentNote.noteId,
        title: originalName,
        content: file.buffer,
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        type: 'file',
        mime: mimeService.getMime(originalName) || file.mimetype
    });

    note.addLabel("originalFileName", originalName);

    taskContext.increaseProgressCount();

    return note;
}

function importCodeNote(taskContext, file, parentNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);
    const content = file.buffer.toString("UTF-8");
    const detectedMime = mimeService.getMime(file.originalname) || file.mimetype;
    const mime = mimeService.normalizeMimeType(detectedMime);

    const {note} = noteService.createNewNote({
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

function importPlainText(taskContext, file, parentNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);
    const plainTextContent = file.buffer.toString("UTF-8");
    const htmlContent = convertTextToHtml(plainTextContent);

    const {note} = noteService.createNewNote({
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
    text = `<p>${text}</p>`;

    return text;
}

function importMarkdown(taskContext, file, parentNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);

    const markdownContent = file.buffer.toString("UTF-8");

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();

    const parsed = reader.parse(markdownContent);
    let htmlContent = writer.render(parsed);

    htmlContent = htmlSanitizer.sanitize(htmlContent);

    htmlContent = handleH1(htmlContent, title);

    const {note} = noteService.createNewNote({
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

function handleH1(content, title) {
    content = content.replace(/<h1>([^<]*)<\/h1>/gi, (match, text) => {
        if (title.trim() === text.trim()) {
            return ""; // remove whole H1 tag
        } else {
            return `<h2>${text}</h2>`;
        }
    });
    return content;
}

function importHtml(taskContext, file, parentNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);
    let content = file.buffer.toString("UTF-8");

    content = htmlSanitizer.sanitize(content);

    content = handleH1(content, title);

    const {note} = noteService.createNewNote({
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

module.exports = {
    importSingleFile
};
