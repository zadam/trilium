"use strict";

const sanitize = require("sanitize-filename");
const TurndownService = require('turndown');

async function exportSingleMarkdown(note, res) {
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(note.content);
    const name = sanitize(note.title);

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.md"');
    res.setHeader('Content-Type', 'text/markdown; charset=UTF-8');

    res.send(markdown);
}

module.exports = {
    exportSingleMarkdown
};