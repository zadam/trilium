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
                content = '<html><head><meta charset="utf-8"></head><body>' + content + '</body></html>';
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
    else if (note.type === 'relation-map' || note.type === 'canvas' || note.type === 'search') {
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
