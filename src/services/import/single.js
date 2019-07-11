"use strict";

const noteService = require('../../services/notes');
const imageService = require('../../services/image');
const protectedSessionService = require('../protected_session');
const commonmark = require('commonmark');
const path = require('path');
const mimeTypes = require('mime-types');

const CODE_MIME_TYPES = {
    'text/plain': true,
    'text/x-csrc': true,
    'text/x-c++src': true,
    'text/x-csharp': true,
    'text/x-clojure': true,
    'text/css': true,
    'text/x-dockerfile': true,
    'text/x-erlang': true,
    'text/x-feature': true,
    'text/x-go': true,
    'text/x-groovy': true,
    'text/x-haskell': true,
    'text/html': true,
    'message/http': true,
    'text/x-java': true,
    'application/javascript': 'application/javascript;env=frontend',
    'application/x-javascript': 'application/javascript;env=frontend',
    'application/json': true,
    'text/x-kotlin': true,
    'text/x-stex': true,
    'text/x-lua': true,
    // possibly later migrate to text/markdown as primary MIME
    'text/markdown': 'text/x-markdown',
    'text/x-markdown': true,
    'text/x-objectivec': true,
    'text/x-pascal': true,
    'text/x-perl': true,
    'text/x-php': true,
    'text/x-python': true,
    'text/x-ruby': true,
    'text/x-rustsrc': true,
    'text/x-scala': true,
    'text/x-sh': true,
    'text/x-sql': true,
    'text/x-swift': true,
    'text/xml': true,
    'text/x-yaml': true
};

// extensions missing in mime-db
const EXTENSION_TO_MIME = {
    ".cs": "text/x-csharp",
    ".clj": "text/x-clojure",
    ".erl": "text/x-erlang",
    ".hrl": "text/x-erlang",
    ".feature": "text/x-feature",
    ".go": "text/x-go",
    ".groovy": "text/x-groovy",
    ".hs": "text/x-haskell",
    ".lhs": "text/x-haskell",
    ".http": "message/http",
    ".kt": "text/x-kotlin",
    ".m": "text/x-objectivec",
    ".py": "text/x-python",
    ".rb": "text/x-ruby",
    ".scala": "text/x-scala",
    ".swift": "text/x-swift"
};

function getMime(fileName) {
    if (fileName.toLowerCase() === 'dockerfile') {
        return "text/x-dockerfile";
    }

    const ext = path.extname(fileName).toLowerCase();

    if (ext in EXTENSION_TO_MIME) {
        return EXTENSION_TO_MIME[ext];
    }

    return mimeTypes.lookup(fileName);
}

async function importSingleFile(importContext, file, parentNote) {
    const mime = getMime(file.originalname);

    if (importContext.textImportedAsText) {
        if (mime === 'text/html') {
            return await importHtml(importContext, file, parentNote);
        } else if (['text/markdown', 'text/x-markdown'].includes(mime)) {
            return await importMarkdown(importContext, file, parentNote);
        } else if (mime === 'text/plain') {
            return await importPlainText(importContext, file, parentNote);
        }
    }

    if (importContext.codeImportedAsCode && mime in CODE_MIME_TYPES) {
        return await importCodeNote(importContext, file, parentNote);
    }

    if (["image/jpeg", "image/gif", "image/png", "image/webp"].includes(mime)) {
        return await importImage(file, parentNote, importContext);
    }

    return await importFile(importContext, file, parentNote);
}

async function importImage(file, parentNote, importContext) {
    const {note} = await imageService.saveImage(file.buffer, file.originalname, parentNote.noteId, importContext.shrinkImages);

    importContext.increaseProgressCount();

    return note;
}

async function importFile(importContext, file, parentNote) {
    const originalName = file.originalname;
    const size = file.size;

    const {note} = await noteService.createNote(parentNote.noteId, originalName, file.buffer, {
        target: 'into',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        type: 'file',
        mime: getMime(originalName),
        attributes: [
            { type: "label", name: "originalFileName", value: originalName },
            { type: "label", name: "fileSize", value: size }
        ]
    });

    importContext.increaseProgressCount();

    return note;
}

async function importCodeNote(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");
    const detectedMime = getMime(file.originalname);
    const mime = CODE_MIME_TYPES[detectedMime] === true ? detectedMime : CODE_MIME_TYPES[detectedMime];

    const {note} = await noteService.createNote(parentNote.noteId, title, content, {
        type: 'code',
        mime: mime,
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable()
    });

    importContext.increaseProgressCount();

    return note;
}

async function importPlainText(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const plainTextContent = file.buffer.toString("UTF-8");
    const htmlContent = convertTextToHtml(plainTextContent);

    const {note} = await noteService.createNote(parentNote.noteId, title, htmlContent, {
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
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
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
    });

    importContext.increaseProgressCount();

    return note;
}

async function importHtml(importContext, file, parentNote) {
    const title = getFileNameWithoutExtension(file.originalname);
    const content = file.buffer.toString("UTF-8");

    const {note} = await noteService.createNote(parentNote.noteId, title, content, {
        type: 'text',
        mime: 'text/html',
        isProtected: parentNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
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