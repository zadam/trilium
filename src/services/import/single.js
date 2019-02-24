"use strict";

const noteService = require('../../services/notes');
const commonmark = require('commonmark');
const path = require('path');

async function importSingleFile(importContext, file, parentNote) {
    if (importContext.textImportedAsText) {
        if (file.mimetype === 'text/html') {
            return importHtml(importContext, file, parentNote);
        } else if (file.mimetype === 'text/markdown') {
            return importMarkdown(importContext, file, parentNote);
        } else if (file.mimetype === 'text/plain') {
            return importPlainText(importContext, file, parentNote);
        }
    }
}

async function importPlainText(importContext, file, parentNote) {

    const title = getFileNameWithoutExtension(file.originalname);
    const plainTextContent = file.buffer.toString("UTF-8");
    const htmlContent = convertTextToHtml(plainTextContent);

    const {note} = await noteService.createNote(parentNote.noteId, title, htmlContent, {
        type: 'text',
        mime: 'text/html'
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
        mime: 'text/html'
    });

    importContext.increaseProgressCount();

    return note;
}

async function importHtml(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");

    const {note} = await noteService.createNote(parentNote.noteId, title, content, {
        type: 'text',
        mime: 'text/html'
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