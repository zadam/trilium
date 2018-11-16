"use strict";

// note that this is for import of single markdown file only - for archive/structure of markdown files
// see tar export/import

const noteService = require('../../services/notes');
const commonmark = require('commonmark');

async function importMarkdown(file, parentNote) {
    const markdownContent = file.buffer.toString("UTF-8");

    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();

    const parsed = reader.parse(markdownContent);
    const htmlContent = writer.render(parsed);

    const title = file.originalname.substr(0, file.originalname.length - 3); // strip .md extension

    const {note} = await noteService.createNote(parentNote.noteId, title, htmlContent, {
        type: 'text',
        mime: 'text/html'
    });

    return note;
}

module.exports = {
    importMarkdown
};