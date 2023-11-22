"use strict";

const mimeTypes = require('mime-types');
const html = require('html');
const utils = require('../utils.js');
const mdService = require('./md.js');
const becca = require('../../becca/becca.js');

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
            content = inlineAttachments(content);

            if (!content.toLowerCase().includes("<html")) {
                content = `<html><head><meta charset="utf-8"></head><body>${content}</body></html>`;
            }

            payload = content.length < 100_000
                ? html.prettyPrint(content, {indent_size: 2})
                : content;

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

function inlineAttachments(content) {
    content = content.replace(/src="[^"]*api\/images\/([a-zA-Z0-9_]+)\/?[^"]+"/g, (match, noteId) => {
        const note = becca.getNote(noteId);
        if (!note || !note.mime.startsWith('image/')) {
            return match;
        }

        const imageContent = note.getContent();
        if (!Buffer.isBuffer(imageContent)) {
            return match;
        }

        const base64Content = imageContent.toString('base64');
        const srcValue = `data:${note.mime};base64,${base64Content}`;

        return `src="${srcValue}"`;
    });

    content = content.replace(/src="[^"]*api\/attachments\/([a-zA-Z0-9_]+)\/image\/?[^"]+"/g, (match, attachmentId) => {
        const attachment = becca.getAttachment(attachmentId);
        if (!attachment || !attachment.mime.startsWith('image/')) {
            return match;
        }

        const attachmentContent = attachment.getContent();
        if (!Buffer.isBuffer(attachmentContent)) {
            return match;
        }

        const base64Content = attachmentContent.toString('base64');
        const srcValue = `data:${attachment.mime};base64,${base64Content}`;

        return `src="${srcValue}"`;
    });

    content = content.replace(/href="[^"]*#root[^"]*attachmentId=([a-zA-Z0-9_]+)\/?"/g, (match, attachmentId) => {
        const attachment = becca.getAttachment(attachmentId);
        if (!attachment) {
            return match;
        }

        const attachmentContent = attachment.getContent();
        if (!Buffer.isBuffer(attachmentContent)) {
            return match;
        }

        const base64Content = attachmentContent.toString('base64');
        const hrefValue = `data:${attachment.mime};base64,${base64Content}`;

        return `href="${hrefValue}" download="${utils.escapeHtml(attachment.title)}"`;
    });

    return content;
}

module.exports = {
    exportSingleNote
};
