"use strict";

import BNote = require("../../becca/entities/bnote");
import TaskContext = require("../task_context");

import noteService = require('../../services/notes');
import imageService = require('../../services/image');
import protectedSessionService = require('../protected_session');
import markdownService = require('./markdown');
import mimeService = require('./mime');
import utils = require('../../services/utils');
import importUtils = require('./utils');
import htmlSanitizer = require('../html_sanitizer');

function importSingleFile(taskContext: TaskContext, file, parentNote: BNote) {
    const mime = mimeService.getMime(file.originalname) || file.mimetype;

    if (taskContext?.data?.textImportedAsText) {
        if (mime === 'text/html') {
            return importHtml(taskContext, file, parentNote);
        } else if (['text/markdown', 'text/x-markdown'].includes(mime)) {
            return importMarkdown(taskContext, file, parentNote);
        } else if (mime === 'text/plain') {
            return importPlainText(taskContext, file, parentNote);
        }
    }

    if (taskContext?.data?.codeImportedAsCode && mimeService.getType(taskContext.data, mime) === 'code') {
        return importCodeNote(taskContext, file, parentNote);
    }

    if (mime.startsWith("image/")) {
        return importImage(file, parentNote, taskContext);
    }

    return importFile(taskContext, file, parentNote);
}

function importImage(file, parentNote: BNote, taskContext) {
    const {note} = imageService.saveImage(parentNote.noteId, file.buffer, file.originalname, taskContext.data.shrinkImages);

    taskContext.increaseProgressCount();

    return note;
}

function importFile(taskContext: TaskContext, file, parentNote: BNote) {
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

function importCodeNote(taskContext: TaskContext, file, parentNote: BNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);
    const content = file.buffer.toString("utf-8");
    const detectedMime = mimeService.getMime(file.originalname) || file.mimetype;
    const mime = mimeService.normalizeMimeType(detectedMime);

    const { note } = noteService.createNewNote({
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

function importPlainText(taskContext: TaskContext, file, parentNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);
    const plainTextContent = file.buffer.toString("utf-8");
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

function convertTextToHtml(text: string) {
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

function importMarkdown(taskContext: TaskContext, file, parentNote: BNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);

    const markdownContent = file.buffer.toString("utf-8");
    let htmlContent = markdownService.renderToHtml(markdownContent, title);

    if (taskContext.data?.safeImport) {
        htmlContent = htmlSanitizer.sanitize(htmlContent);
    }

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

function importHtml(taskContext: TaskContext, file, parentNote: BNote) {
    const title = utils.getNoteTitle(file.originalname, taskContext.data.replaceUnderscoresWithSpaces);
    let content = file.buffer.toString("utf-8");

    if (taskContext?.data?.safeImport) {
        content = htmlSanitizer.sanitize(content);
    }

    content = importUtils.handleH1(content, title);

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

function importAttachment(taskContext: TaskContext, file, parentNote: BNote) {
    const mime = mimeService.getMime(file.originalname) || file.mimetype;

    if (mime.startsWith("image/")) {
        imageService.saveImageToAttachment(parentNote.noteId, file.buffer, file.originalname, taskContext.data?.shrinkImages);

        taskContext.increaseProgressCount();
    } else {
        parentNote.saveAttachment({
            title: file.originalname,
            content: file.buffer,
            role: 'file',
            mime: mime
        });

        taskContext.increaseProgressCount();
    }
}

export = {
    importSingleFile,
    importAttachment
};
