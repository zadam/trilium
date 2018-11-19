"use strict";

const sanitize = require("sanitize-filename");
const TurndownService = require('turndown');

async function exportSingleMarkdown(note, res) {
    if (note.type !== 'text' && note.type !== 'code') {
        return [400, `Note type ${note.type} cannot be exported as single markdown file.`];
    }

    let markdown;

    if (note.type === 'code') {
        markdown = '```\n' + note.content + "\n```";
    }
    else if (note.type === 'text') {
        const turndownService = new TurndownService();
        markdown = turndownService.turndown(note.content);
    }

    const name = sanitize(note.title);

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.md"');
    res.setHeader('Content-Type', 'text/markdown; charset=UTF-8');

    res.send(markdown);
}

module.exports = {
    exportSingleMarkdown
};