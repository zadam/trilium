"use strict";

const mimeTypes = require('mime-types');
const html = require('html');
const utils = require('../utils');
const mdService = require('./md');
const becca = require("../../becca/becca");

function exportSingleNote(taskContext, branch, format, res) {
    const note = branch.getNote();

    if (note.type === 'image' || note.type === 'file') {
        return [400, `Note type '${note.type}' cannot be exported as single file.`];
    }

    if (format !== 'html' && format !== 'markdown') {
        return [400, `Unrecognized format '${format}'`];
    }

    let payload, extension, mime;

    let content = note.getContent();

    if (note.type === 'text') {
        if (format === 'html') {
            content = inlineAttachmentImages(content);

            if (!content.toLowerCase().includes("<html")) {
                content = `<html><head><meta charset="utf-8"></head><body>${content}</body></html>`;
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
    else if (note.type === 'relationMap' || note.type === 'canvas' || note.type === 'search') {
        payload = content;
        extension = 'json';
        mime = 'application/json';
    }

    const fileName = `${note.title}.${extension}`;

    res.setHeader('Content-Disposition', utils.getContentDisposition(fileName));
    res.setHeader('Content-Type', `${mime}; charset=UTF-8`);

    res.send(payload);

    taskContext.increaseProgressCount();
    taskContext.taskSucceeded();
}

function inlineAttachmentImages(content) {
    const re = /src="[^"]*api\/attachments\/([a-zA-Z0-9_]+)\/image\/?[^"]+"/g;
    let match;

    while (match = re.exec(content)) {
        const attachment = becca.getAttachment(match[1]);
        if (!attachment) {
            continue;
        }

        if (!attachment.mime.startsWith('image/')) {
            continue;
        }

        const attachmentContent = attachment.getContent();
        if (!Buffer.isBuffer(attachmentContent)) {
            continue;
        }

        const base64Content = attachmentContent.toString('base64');
        const srcValue = `data:${attachment.mime};base64,${base64Content}`;

        content = content.replaceAll(match[0], `src="${srcValue}"`);
    }

    return content;
}

module.exports = {
    exportSingleNote
};
