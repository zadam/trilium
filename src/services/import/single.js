"use strict";

const noteService = require('../../services/notes');
const commonmark = require('commonmark');
const path = require('path');

async function importMarkdown(file, parentNote) {
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

    return note;
}

async function importHtml(file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");

    const {note} = await noteService.createNote(parentNote.noteId, title, content, {
        type: 'text',
        mime: 'text/html'
    });

    return note;
}

function getFileNameWithoutExtension(filePath) {
    const extension = path.extname(filePath);

    return filePath.substr(0, filePath.length - extension.length);
}

module.exports = {
    importMarkdown,
    importHtml
};