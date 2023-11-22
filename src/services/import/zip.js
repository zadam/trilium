"use strict";

const BAttribute = require('../../becca/entities/battribute.js');
const utils = require('../../services/utils.js');
const log = require('../../services/log.js');
const noteService = require('../../services/notes.js');
const attributeService = require('../../services/attributes.js');
const BBranch = require('../../becca/entities/bbranch.js');
const path = require('path');
const protectedSessionService = require('../protected_session.js');
const mimeService = require('./mime.js');
const treeService = require('../tree.js');
const yauzl = require("yauzl");
const htmlSanitizer = require('../html_sanitizer.js');
const becca = require('../../becca/becca.js');
const BAttachment = require('../../becca/entities/battachment.js');
const markdownService = require('./markdown.js');

/**
 * @param {TaskContext} taskContext
 * @param {Buffer} fileBuffer
 * @param {BNote} importRootNote
 * @returns {Promise<BNote>}
 */
async function importZip(taskContext, fileBuffer, importRootNote) {
    /** @type {Object.<string, string>} maps from original noteId (in ZIP file) to newly generated noteId */
    const noteIdMap = {};
    /** @type {Object.<string, string>} maps from original attachmentId (in ZIP file) to newly generated attachmentId */
    const attachmentIdMap = {};
    const attributes = [];
    // path => noteId, used only when meta file is not available
    /** @type {Object.<string, string>} path => noteId | attachmentId */
    const createdPaths = { '/': importRootNote.noteId, '\\': importRootNote.noteId };
    let metaFile = null;
    /** @type {BNote} */
    let firstNote = null;
    /** @type {Set.<string>} */
    const createdNoteIds = new Set();

    function getNewNoteId(origNoteId) {
        if (!origNoteId.trim()) {
            // this probably shouldn't happen, but still good to have this precaution
            return "empty_note_id";
        }

        if (origNoteId === 'root' || origNoteId.startsWith("_")) {
            // these "named" noteIds don't differ between Trilium instances
            return origNoteId;
        }

        if (!noteIdMap[origNoteId]) {
            noteIdMap[origNoteId] = utils.newEntityId();
        }

        return noteIdMap[origNoteId];
    }

    function getNewAttachmentId(origAttachmentId) {
        if (!origAttachmentId.trim()) {
            // this probably shouldn't happen, but still good to have this precaution
            return "empty_attachment_id";
        }

        if (!attachmentIdMap[origAttachmentId]) {
            attachmentIdMap[origAttachmentId] = utils.newEntityId();
        }

        return attachmentIdMap[origAttachmentId];
    }

    /**
     * @param {NoteMeta} parentNoteMeta
     * @param {string} dataFileName
     */
    function getAttachmentMeta(parentNoteMeta, dataFileName) {
        for (const noteMeta of parentNoteMeta.children) {
            for (const attachmentMeta of noteMeta.attachments || []) {
                if (attachmentMeta.dataFileName === dataFileName) {
                    return {
                        parentNoteMeta,
                        noteMeta,
                        attachmentMeta
                    };
                }
            }
        }

        return {};
    }

    /** @returns {{noteMeta: NoteMeta|undefined, parentNoteMeta: NoteMeta|undefined, attachmentMeta: AttachmentMeta|undefined}} */
    function getMeta(filePath) {
        if (!metaFile) {
            return {};
        }

        const pathSegments = filePath.split(/[\/\\]/g);

        /** @type {NoteMeta} */
        let cursor = {
            isImportRoot: true,
            children: metaFile.files
        };

        /** @type {NoteMeta} */
        let parent;

        for (const segment of pathSegments) {
            if (!cursor?.children?.length) {
                return {};
            }

            parent = cursor;
            cursor = parent.children.find(file => file.dataFileName === segment || file.dirFileName === segment);

            if (!cursor) {
                return getAttachmentMeta(parent, segment);
            }
        }

        return {
            parentNoteMeta: parent,
            noteMeta: cursor
        };
    }

    /**
     * @param {string} filePath
     * @param {NoteMeta} parentNoteMeta
     * @return {string}
     */
    function getParentNoteId(filePath, parentNoteMeta) {
        let parentNoteId;

        if (parentNoteMeta) {
            parentNoteId = parentNoteMeta.isImportRoot ? importRootNote.noteId : getNewNoteId(parentNoteMeta.noteId);
        }
        else {
            const parentPath = path.dirname(filePath);

            if (parentPath === '.') {
                parentNoteId = importRootNote.noteId;
            } else if (parentPath in createdPaths) {
                parentNoteId = createdPaths[parentPath];
            } else {
                // ZIP allows creating out of order records - i.e., file in a directory can appear in the ZIP stream before the actual directory
                parentNoteId = saveDirectory(parentPath);
            }
        }

        return parentNoteId;
    }

    /**
     * @param {NoteMeta} noteMeta
     * @param {string} filePath
     * @return {string}
     */
    function getNoteId(noteMeta, filePath) {
        if (noteMeta) {
            return getNewNoteId(noteMeta.noteId);
        }

        // in case we lack metadata, we treat e.g. "Programming.html" and "Programming" as the same note
        // (one data file, the other directory for children)
        const filePathNoExt = utils.removeTextFileExtension(filePath);

        if (filePathNoExt in createdPaths) {
            return createdPaths[filePathNoExt];
        }

        const noteId = utils.newEntityId();

        createdPaths[filePathNoExt] = noteId;

        return noteId;
    }

    function detectFileTypeAndMime(taskContext, filePath) {
        const mime = mimeService.getMime(filePath) || "application/octet-stream";
        const type = mimeService.getType(taskContext.data, mime);

        return { mime, type };
    }

    /**
     * @param {BNote} note
     * @param {NoteMeta} noteMeta
     */
    function saveAttributes(note, noteMeta) {
        if (!noteMeta) {
            return;
        }

        for (const attr of noteMeta.attributes) {
            attr.noteId = note.noteId;

            if (attr.type === 'label-definition') {
                attr.type = 'label';
                attr.name = `label:${attr.name}`;
            }
            else if (attr.type === 'relation-definition') {
                attr.type = 'label';
                attr.name = `relation:${attr.name}`;
            }

            if (!attributeService.isAttributeType(attr.type)) {
                log.error(`Unrecognized attribute type ${attr.type}`);
                continue;
            }

            if (attr.type === 'relation' && ['internalLink', 'imageLink', 'relationMapLink', 'includeNoteLink'].includes(attr.name)) {
                // these relations are created automatically and as such don't need to be duplicated in the import
                continue;
            }

            if (attr.type === 'relation') {
                attr.value = getNewNoteId(attr.value);
            }

            if (taskContext.data.safeImport && attributeService.isAttributeDangerous(attr.type, attr.name)) {
                attr.name = `disabled:${attr.name}`;
            }

            if (taskContext.data.safeImport) {
                attr.name = htmlSanitizer.sanitize(attr.name);
                attr.value = htmlSanitizer.sanitize(attr.value);
            }

            attributes.push(attr);
        }
    }

    function saveDirectory(filePath) {
        const { parentNoteMeta, noteMeta } = getMeta(filePath);

        const noteId = getNoteId(noteMeta, filePath);

        if (becca.getNote(noteId)) {
            return;
        }

        const noteTitle = utils.getNoteTitle(filePath, taskContext.data.replaceUnderscoresWithSpaces, noteMeta);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta);

        const {note} = noteService.createNewNote({
            parentNoteId: parentNoteId,
            title: noteTitle,
            content: '',
            noteId: noteId,
            type: resolveNoteType(noteMeta?.type),
            mime: noteMeta ? noteMeta.mime : 'text/html',
            prefix: noteMeta ? noteMeta.prefix : '',
            isExpanded: noteMeta ? noteMeta.isExpanded : false,
            notePosition: (noteMeta && firstNote) ? noteMeta.notePosition : undefined,
            isProtected: importRootNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        });

        createdNoteIds.add(note.noteId);

        saveAttributes(note, noteMeta);

        firstNote = firstNote || note;

        return noteId;
    }

    /** @returns {{attachmentId: string}|{noteId: string}} */
    function getEntityIdFromRelativeUrl(url, filePath) {
        while (url.startsWith("./")) {
            url = url.substr(2);
        }

        let absUrl = path.dirname(filePath);

        while (url.startsWith("../")) {
            absUrl = path.dirname(absUrl);

            url = url.substr(3);
        }

        if (absUrl === '.') {
            absUrl = '';
        }

        absUrl += `${absUrl.length > 0 ? '/' : ''}${url}`;

        const { noteMeta, attachmentMeta } = getMeta(absUrl);

        if (attachmentMeta) {
            return {
                attachmentId: getNewAttachmentId(attachmentMeta.attachmentId),
                noteId: getNewNoteId(noteMeta.noteId)
            };
        } else { // don't check for noteMeta since it's not mandatory for notes
            return {
                noteId: getNoteId(noteMeta, absUrl)
            };
        }
    }

    /**
     * @param {string} content
     * @param {string} noteTitle
     * @param {string} filePath
     * @param {NoteMeta} noteMeta
     * @return {string}
     */
    function processTextNoteContent(content, noteTitle, filePath, noteMeta) {
        function isUrlAbsolute(url) {
            return /^(?:[a-z]+:)?\/\//i.test(url);
        }

        content = removeTriliumTags(content);

        content = content.replace(/<h1>([^<]*)<\/h1>/gi, (match, text) => {
            if (noteTitle.trim() === text.trim()) {
                return ""; // remove whole H1 tag
            } else {
                return `<h2>${text}</h2>`;
            }
        });

        if (taskContext.data.safeImport) {
            content = htmlSanitizer.sanitize(content);
        }

        content = content.replace(/<html.*<body[^>]*>/gis, "");
        content = content.replace(/<\/body>.*<\/html>/gis, "");

        content = content.replace(/src="([^"]*)"/g, (match, url) => {
            if (url.startsWith("data:image")) {
                // inline images are parsed and saved into attachments in the note service
                return match;
            }

            try {
                url = decodeURIComponent(url).trim();
            } catch (e) {
                log.error(`Cannot parse image URL '${url}', keeping original. Error: ${e.message}.`);
                return `src="${url}"`;
            }

            if (isUrlAbsolute(url) || url.startsWith("/")) {
                return match;
            }

            const target = getEntityIdFromRelativeUrl(url, filePath);

            if (target.attachmentId) {
                return `src="api/attachments/${target.attachmentId}/image/${path.basename(url)}"`;
            } else if (target.noteId) {
                return `src="api/images/${target.noteId}/${path.basename(url)}"`;
            } else {
                return match;
            }
        });

        content = content.replace(/href="([^"]*)"/g, (match, url) => {
            try {
                url = decodeURIComponent(url).trim();
            } catch (e) {
                log.error(`Cannot parse link URL '${url}', keeping original. Error: ${e.message}.`);
                return `href="${url}"`;
            }

            if (url.startsWith('#') // already a note path (probably)
                || isUrlAbsolute(url)) {
                return match;
            }

            const target = getEntityIdFromRelativeUrl(url, filePath);

            if (target.attachmentId) {
                return `href="#root/${target.noteId}?viewMode=attachments&attachmentId=${target.attachmentId}"`;
            } else if (target.noteId) {
                return `href="#root/${target.noteId}"`;
            } else {
                return match;
            }
        });

        if (noteMeta) {
            const includeNoteLinks = (noteMeta.attributes || [])
                .filter(attr => attr.type === 'relation' && attr.name === 'includeNoteLink');

            for (const link of includeNoteLinks) {
                // no need to escape the regexp find string since it's a noteId which doesn't contain any special characters
                content = content.replace(new RegExp(link.value, "g"), getNewNoteId(link.value));
            }
        }

        content = content.trim();

        return content;
    }

    function removeTriliumTags(content) {
        const tagsToRemove = [
            '<h1 data-trilium-h1>([^<]*)<\/h1>',
            '<title data-trilium-title>([^<]*)<\/title>'
        ]
        for (const tag of tagsToRemove) {
            let re = new RegExp(tag, "gi");
            content = content.replace(re, '');
        }
        return content;
    }

    /**
     * @param {NoteMeta} noteMeta
     * @param {string} type
     * @param {string} mime
     * @param {string|Buffer} content
     * @param {string} noteTitle
     * @param {string} filePath
     * @return {string}
     */
    function processNoteContent(noteMeta, type, mime, content, noteTitle, filePath) {
        if (noteMeta?.format === 'markdown'
            || (!noteMeta && taskContext.data.textImportedAsText && ['text/markdown', 'text/x-markdown'].includes(mime))) {
            content = markdownService.renderToHtml(content, noteTitle);
        }

        if (type === 'text') {
            content = processTextNoteContent(content, noteTitle, filePath, noteMeta);
        }

        if (type === 'relationMap' && noteMeta) {
            const relationMapLinks = (noteMeta.attributes || [])
                .filter(attr => attr.type === 'relation' && attr.name === 'relationMapLink');

            // this will replace relation map links
            for (const link of relationMapLinks) {
                // no need to escape the regexp find string since it's a noteId which doesn't contain any special characters
                content = content.replace(new RegExp(link.value, "g"), getNewNoteId(link.value));
            }
        }

        return content;
    }

    /**
     * @param {string} filePath
     * @param {Buffer} content
     */
    function saveNote(filePath, content) {
        const { parentNoteMeta, noteMeta, attachmentMeta } = getMeta(filePath);

        if (noteMeta?.noImport) {
            return;
        }

        const noteId = getNoteId(noteMeta, filePath);

        if (attachmentMeta) {
            const attachment = new BAttachment({
                attachmentId: getNewAttachmentId(attachmentMeta.attachmentId),
                ownerId: noteId,
                title: attachmentMeta.title,
                role: attachmentMeta.role,
                mime: attachmentMeta.mime,
                position: attachmentMeta.position
            });

            attachment.setContent(content, { forceSave: true });
            return;
        }

        const parentNoteId = getParentNoteId(filePath, parentNoteMeta);

        if (!parentNoteId) {
            throw new Error(`Cannot find parentNoteId for '${filePath}'`);
        }

        if (noteMeta?.isClone) {
            if (!becca.getBranchFromChildAndParent(noteId, parentNoteId)) {
                new BBranch({
                    noteId,
                    parentNoteId,
                    isExpanded: noteMeta.isExpanded,
                    prefix: noteMeta.prefix,
                    notePosition: noteMeta.notePosition
                }).save();
            }

            return;
        }

        let { type, mime } = noteMeta ? noteMeta : detectFileTypeAndMime(taskContext, filePath);
        type = resolveNoteType(type);

        if (type !== 'file' && type !== 'image') {
            content = content.toString("utf-8");
        }

        const noteTitle = utils.getNoteTitle(filePath, taskContext.data.replaceUnderscoresWithSpaces, noteMeta);

        content = processNoteContent(noteMeta, type, mime, content, noteTitle, filePath);

        let note = becca.getNote(noteId);

        const isProtected = importRootNote.isProtected && protectedSessionService.isProtectedSessionAvailable();

        if (note) {
            // only skeleton was created because of altered order of cloned notes in ZIP, we need to update
            // https://github.com/zadam/trilium/issues/2440
            if (note.type === undefined) {
                note.type = type;
                note.mime = mime;
                note.title = noteTitle;
                note.isProtected = isProtected;
                note.save();
            }

            note.setContent(content);

            if (!becca.getBranchFromChildAndParent(noteId, parentNoteId)) {
                new BBranch({
                    noteId,
                    parentNoteId,
                    isExpanded: noteMeta.isExpanded,
                    prefix: noteMeta.prefix,
                    notePosition: noteMeta.notePosition
                }).save();
            }
        }
        else {
            ({note} = noteService.createNewNote({
                parentNoteId: parentNoteId,
                title: noteTitle,
                content: content,
                noteId,
                type,
                mime,
                prefix: noteMeta ? noteMeta.prefix : '',
                isExpanded: noteMeta ? noteMeta.isExpanded : false,
                // root notePosition should be ignored since it relates to the original document
                // now import root should be placed after existing notes into new parent
                notePosition: (noteMeta && firstNote) ? noteMeta.notePosition : undefined,
                isProtected: isProtected,
            }));

            createdNoteIds.add(note.noteId);

            saveAttributes(note, noteMeta);

            firstNote = firstNote || note;
        }

        if (!noteMeta && (type === 'file' || type === 'image')) {
            attributes.push({
                noteId,
                type: 'label',
                name: 'originalFileName',
                value: path.basename(filePath)
            });
        }
    }

    // we're running two passes to make sure that the meta file is loaded before the rest of the files is processed.

    await readZipFile(fileBuffer, async (zipfile, entry) => {
        const filePath = normalizeFilePath(entry.fileName);

        if (filePath === '!!!meta.json') {
            const content = await readContent(zipfile, entry);

            metaFile = JSON.parse(content.toString("utf-8"));
        }

        zipfile.readEntry();
    });

    await readZipFile(fileBuffer, async (zipfile, entry) => {
        const filePath = normalizeFilePath(entry.fileName);

        if (/\/$/.test(entry.fileName)) {
            saveDirectory(filePath);
        }
        else if (filePath !== '!!!meta.json') {
            const content = await readContent(zipfile, entry);

            saveNote(filePath, content);
        }

        taskContext.increaseProgressCount();
        zipfile.readEntry();
    });

    for (const noteId of createdNoteIds) {
        const note = becca.getNote(noteId);
        await noteService.asyncPostProcessContent(note, note.getContent());

        if (!metaFile) {
            // if there's no meta file, then the notes are created based on the order in that zip file but that
            // is usually quite random, so we sort the notes in the way they would appear in the file manager
            treeService.sortNotes(noteId, 'title', false, true);
        }

        taskContext.increaseProgressCount();
    }

    // we're saving attributes and links only now so that all relation and link target notes
    // are already in the database (we don't want to have "broken" relations, not even transitionally)
    for (const attr of attributes) {
        if (attr.type !== 'relation' || attr.value in becca.notes) {
            new BAttribute(attr).save();
        }
        else {
            log.info(`Relation not imported since the target note doesn't exist: ${JSON.stringify(attr)}`);
        }
    }

    return firstNote;
}

/** @returns {string} path without leading or trailing slash and backslashes converted to forward ones */
function normalizeFilePath(filePath) {
    filePath = filePath.replace(/\\/g, "/");

    if (filePath.startsWith("/")) {
        filePath = filePath.substr(1);
    }

    if (filePath.endsWith("/")) {
        filePath = filePath.substr(0, filePath.length - 1);
    }

    return filePath;
}

/** @returns {Promise<Buffer>} */
function streamToBuffer(stream) {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));

    return new Promise((res, rej) => stream.on('end', () => res(Buffer.concat(chunks))));
}

/** @returns {Promise<Buffer>} */
function readContent(zipfile, entry) {
    return new Promise((res, rej) => {
        zipfile.openReadStream(entry, function(err, readStream) {
            if (err) rej(err);

            streamToBuffer(readStream).then(res);
        });
    });
}

function readZipFile(buffer, processEntryCallback) {
    return new Promise((res, rej) => {
        yauzl.fromBuffer(buffer, {lazyEntries: true, validateEntrySizes: false}, function(err, zipfile) {
            if (err) throw err;
            zipfile.readEntry();
            zipfile.on("entry", entry => processEntryCallback(zipfile, entry));
            zipfile.on("end", res);
        });
    });
}

function resolveNoteType(type) {
    // BC for ZIPs created in Triliun 0.57 and older
    if (type === 'relation-map') {
        type = 'relationMap';
    } else if (type === 'note-map') {
        type = 'noteMap';
    } else if (type === 'web-view') {
        type = 'webView';
    }

    return type || "text";
}


module.exports = {
    importZip
};
