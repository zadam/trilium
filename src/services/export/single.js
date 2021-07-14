"use strict";

const mimeTypes = require('mime-types');
const html = require('html');
const utils = require('../utils');
const mdService = require('./md');

function exportSingleNote(taskContext, branch, format, res) {
    const note = branch.getNote();

    if (note.type === 'image' || note.type === 'file') {
        return [400, `Note type ${note.type} cannot be exported as single file.`];
    }

    if (format !== 'html' && format !== 'markdown') {
        return [400, 'Unrecognized format ' + format];
    }

    let payload, extension, mime;

    let content = note.getContent();

    if (note.type === 'text') {
        if (format === 'html') {
            if (!content.toLowerCase().includes("<html")) {
            	// KaTeX Auto-render Extension — from https://katex.org/docs/autorender.html
            	let katexRender = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.css" integrity="sha384-Um5gpz1odJg5Z4HAmzPtgZKdTBHZdw8S29IecapCSB31ligYPhHQZMIlWLYQGVoc" crossorigin="anonymous">
					<script defer src="https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.js" integrity="sha384-YNHdsYkH6gMx9y3mRkmcJ2mFUjTd0qNQQvY9VYZgQd7DcN7env35GzlmFaZ23JGp" crossorigin="anonymous"></script>
					<script defer src="https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/contrib/auto-render.min.js" integrity="sha384-vZTG03m+2yp6N6BNi5iM4rW4oIwk5DfcNdFfxkk9ZWpDriOkXX8voJBFrAO7MpVl" crossorigin="anonymous" onload="renderMathInElement(document.body);"></script>`;
                content = '<!doctype html><html><head><meta charset="utf-8">' + katexRender + '</head><body>' + content + '</body></html>';
            }

            payload = html.prettyPrint(content, {indent_size: 2});
            extension = 'html';
            mime = 'text/html';
        }
        else if (format === 'markdown') {
            payload = mdService.toMarkdown(content);
            extension = 'md';
            mime = 'text/x-markdown'
        }
    }
    else if (note.type === 'code') {
        payload = content;
        extension = mimeTypes.extension(note.mime) || 'code';
        mime = note.mime;
    }
    else if (note.type === 'relation-map' || note.type === 'search') {
        payload = content;
        extension = 'json';
        mime = 'application/json';
    }

    const filename = note.title + "." + extension;

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    res.setHeader('Content-Type', mime + '; charset=UTF-8');

    res.send(payload);

    taskContext.increaseProgressCount();
    taskContext.taskSucceeded();
}

module.exports = {
    exportSingleNote
};
