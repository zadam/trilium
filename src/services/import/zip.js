"use strict";

const Attribute = require('../../becca/entities/attribute');
const utils = require('../../services/utils');
const log = require('../../services/log');
const noteService = require('../../services/notes');
const attributeService = require('../../services/attributes');
const Branch = require('../../becca/entities/branch');
const path = require('path');
const commonmark = require('commonmark');
const protectedSessionService = require('../protected_session');
const mimeService = require("./mime");
const treeService = require("../tree");
const yauzl = require("yauzl");
const htmlSanitizer = require('../html_sanitizer');
const becca = require("../../becca/becca");

/**
 * @param {TaskContext} taskContext
 * @param {Buffer} fileBuffer
 * @param {Note} importRootNote
 * @return {Promise<*>}
 */
async function importZip(taskContext, fileBuffer, importRootNote) {
    // maps from original noteId (in tar file) to newly generated noteId
    const noteIdMap = {};
    const attributes = [];
    // path => noteId, used only when meta file is not available
    const createdPaths = { '/': importRootNote.noteId, '\\': importRootNote.noteId };
    const mdReader = new commonmark.Parser();
    const mdWriter = new commonmark.HtmlRenderer();
    let metaFile = null;
    let firstNote = null;
    const createdNoteIds = {};

    function getNewNoteId(origNoteId) {
        // in case the original noteId is empty. This probably shouldn't happen, but still good to have this precaution
        if (!origNoteId.trim()) {
            return "";
        }

        if (!noteIdMap[origNoteId]) {
            noteIdMap[origNoteId] = utils.newEntityId();
        }

        return noteIdMap[origNoteId];
    }

    function getMeta(filePath) {
        if (!metaFile) {
            return {};
        }

        const pathSegments = filePath.split(/[\/\\]/g);

        let cursor = {
            isImportRoot: true,
            children: metaFile.files
        };

        let parent;

        for (const segment of pathSegments) {
            if (!cursor || !cursor.children || cursor.children.length === 0) {
                return {};
            }

            parent = cursor;
            cursor = cursor.children.find(file => file.dataFileName === segment || file.dirFileName === segment);
        }

        return {
            parentNoteMeta: parent,
            noteMeta: cursor
        };
    }

    function getParentNoteId(filePath, parentNoteMeta) {
        let parentNoteId;

        if (parentNoteMeta) {
            parentNoteId = parentNoteMeta.isImportRoot ? importRootNote.noteId : getNewNoteId(parentNoteMeta.noteId);
        }
        else {
            const parentPath = path.dirname(filePath);

            if (parentPath === '.') {
                parentNoteId = importRootNote.noteId;
            }
            else if (parentPath in createdPaths) {
                parentNoteId = createdPaths[parentPath];
            }
            else {
                // tar allows creating out of order records - i.e. file in a directory can appear in the tar stream before actual directory
                // (out-of-order-directory-records.tar in test set)
                parentNoteId = saveDirectory(parentPath);
            }
        }

        return parentNoteId;
    }

    function getNoteId(noteMeta, filePath) {
        if (noteMeta) {
            return getNewNoteId(noteMeta.noteId);
        }

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

    function saveAttributes(note, noteMeta) {
        if (!noteMeta) {
            return;
        }

        for (const attr of noteMeta.attributes) {
            attr.noteId = note.noteId;

            if (attr.type === 'label-definition') {
                attr.type = 'label';
                attr.name = 'label:' + attr.name;
            }
            else if (attr.type === 'relation-definition') {
                attr.type = 'label';
                attr.name = 'relation:' + attr.name;
            }

            if (!attributeService.isAttributeType(attr.type)) {
                log.error("Unrecognized attribute type " + attr.type);
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
                attr.name = 'disabled:' + attr.name;
            }

            attributes.push(attr);
        }
    }

    function saveDirectory(filePath) {
        const { parentNoteMeta, noteMeta } = getMeta(filePath);

        const noteId = getNoteId(noteMeta, filePath);
        const noteTitle = utils.getNoteTitle(filePath, taskContext.data.replaceUnderscoresWithSpaces, noteMeta);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta);

        let note = becca.getNote(noteId);

        if (note) {
            return;
        }

        ({note} = noteService.createNewNote({
            parentNoteId: parentNoteId,
            title: noteTitle,
            content: '',
            noteId: noteId,
            type: noteMeta ? noteMeta.type : 'text',
            mime: noteMeta ? noteMeta.mime : 'text/html',
            prefix: noteMeta ? noteMeta.prefix : '',
            isExpanded: noteMeta ? noteMeta.isExpanded : false,
            notePosition: (noteMeta && firstNote) ? noteMeta.notePosition : undefined,
            isProtected: importRootNote.isProtected && protectedSessionService.isProtectedSessionAvailable(),
        }));

        createdNoteIds[note.noteId] = true;

        saveAttributes(note, noteMeta);

        if (!firstNote) {
            firstNote = note;
        }

        return noteId;
    }

    function getNoteIdFromRelativeUrl(url, filePath) {
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

        absUrl += (absUrl.length > 0 ? '/' : '') + url;

        const {noteMeta} = getMeta(absUrl);
        const targetNoteId = getNoteId(noteMeta, absUrl);
        return targetNoteId;
    }

    function saveNote(filePath, content) {
        const {parentNoteMeta, noteMeta} = getMeta(filePath);

        if (noteMeta && noteMeta.noImport) {
            return;
        }

        const noteId = getNoteId(noteMeta, filePath);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta);

        if (!parentNoteId) {
            throw new Error(`Cannot find parentNoteId for ${filePath}`);
        }

        if (noteMeta && noteMeta.isClone) {
            if (!becca.getBranchFromChildAndParent(noteId, parentNoteId)) {
                new Branch({
                    noteId,
                    parentNoteId,
                    isExpanded: noteMeta.isExpanded,
                    prefix: noteMeta.prefix,
                    notePosition: noteMeta.notePosition
                }).save();
            }

            return;
        }

        const {type, mime} = noteMeta ? noteMeta : detectFileTypeAndMime(taskContext, filePath);

        if (type !== 'file' && type !== 'image') {
            content = content.toString("UTF-8");
        }

        if ((noteMeta && noteMeta.format === 'markdown')
            || (!noteMeta && taskContext.data.textImportedAsText && ['text/markdown', 'text/x-markdown'].includes(mime))) {
            const parsed = mdReader.parse(content);
            content = mdWriter.render(parsed);
        }

        const noteTitle = utils.getNoteTitle(filePath, taskContext.data.replaceUnderscoresWithSpaces, noteMeta);

        if (type === 'text') {
            function isUrlAbsolute(url) {
                return /^(?:[a-z]+:)?\/\//i.test(url);
            }

            content = content.replace(/<h1>([^<]*)<\/h1>/gi, (match, text) => {
                if (noteTitle.trim() === text.trim()) {
                    return ""; // remove whole H1 tag
                }
                else {
                    return `<h2>${text}</h2>`;
                }
            });

            content = htmlSanitizer.sanitize(content);

            content = content.replace(/<html.*<body[^>]*>/gis, "");
            content = content.replace(/<\/body>.*<\/html>/gis, "");

            content = content.replace(/src="([^"]*)"/g, (match, url) => {
                url = decodeURIComponent(url);

                if (isUrlAbsolute(url) || url.startsWith("/")) {
                    return match;
                }

                const targetNoteId = getNoteIdFromRelativeUrl(url, filePath);

                return `src="api/images/${targetNoteId}/${path.basename(url)}"`;
            });

            content = content.replace(/href="([^"]*)"/g, (match, url) => {
                url = decodeURIComponent(url);

                if (isUrlAbsolute(url)) {
                    return match;
                }

                const targetNoteId = getNoteIdFromRelativeUrl(url, filePath);

                return `href="#root/${targetNoteId}"`;
            });

            content = content.replace(/data-note-path="([^"]*)"/g, (match, notePath) => {
                const noteId = notePath.split("/").pop();

                const targetNoteId = noteIdMap[noteId];

                return `data-note-path="root/${targetNoteId}"`;
            });

            if (noteMeta) {
                const includeNoteLinks = (noteMeta.attributes || [])
                    .filter(attr => attr.type === 'relation' && attr.name === 'includeNoteLink');

                for (const link of includeNoteLinks) {
                    // no need to escape the regexp find string since it's a noteId which doesn't contain any special characters
                    content = content.replace(new RegExp(link.value, "g"), getNewNoteId(link.value));
                }
            }
        }

        if (type === 'relation-map' && noteMeta) {
            const relationMapLinks = (noteMeta.attributes || [])
                .filter(attr => attr.type === 'relation' && attr.name === 'relationMapLink');

            // this will replace relation map links
            for (const link of relationMapLinks) {
                // no need to escape the regexp find string since it's a noteId which doesn't contain any special characters
                content = content.replace(new RegExp(link.value, "g"), getNewNoteId(link.value));
            }
        }

        if (type === 'text' && noteMeta) {
            const includeNoteLinks = (noteMeta.attributes || [])
                .filter(attr => attr.type === 'relation' && attr.name === 'includeNoteLink');

            // this will replace relation map links
            for (const link of includeNoteLinks) {
                // no need to escape the regexp find string since it's a noteId which doesn't contain any special characters
                content = content.replace(new RegExp(link.value, "g"), getNewNoteId(link.value));
            }
        }

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
                new Branch({
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
                // root notePosition should be ignored since it relates to original document
                // now import root should be placed after existing notes into new parent
                notePosition: (noteMeta && firstNote) ? noteMeta.notePosition : undefined,
                isProtected: isProtected,
            }));

            createdNoteIds[note.noteId] = true;

            saveAttributes(note, noteMeta);

            if (!firstNote) {
                firstNote = note;
            }

            if (type === 'text') {
                filePath = utils.removeTextFileExtension(filePath);
            }
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

    /** @returns {string} path without leading or trailing slash and backslashes converted to forward ones*/
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

    function streamToBuffer(stream) {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));

        return new Promise((res, rej) => stream.on('end', () => res(Buffer.concat(chunks))));
    }

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

    // we're running two passes to make sure that the meta file is loaded before the rest of the files is processed.

    await readZipFile(fileBuffer, async (zipfile, entry) => {
        const filePath = normalizeFilePath(entry.fileName);

        if (filePath === '!!!meta.json') {
            const content = await readContent(zipfile, entry);

            metaFile = JSON.parse(content.toString("UTF-8"));
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

    for (const noteId in createdNoteIds) { // now the noteIds are unique
        noteService.scanForLinks(becca.getNote(noteId));

        if (!metaFile) {
            // if there's no meta file then the notes are created based on the order in that zip file but that
            // is usually quite random so we sort the notes in the way they would appear in the file manager
            treeService.sortNotes(noteId, 'title', false, true);
        }

        taskContext.increaseProgressCount();
    }

    // we're saving attributes and links only now so that all relation and link target notes
    // are already in the database (we don't want to have "broken" relations, not even transitionally)
    for (const attr of attributes) {
        if (attr.type !== 'relation' || attr.value in createdNoteIds) {
            new Attribute(attr).save();
        }
        else {
            log.info("Relation not imported since target note doesn't exist: " + JSON.stringify(attr));
        }
    }

    return firstNote;
}

module.exports = {
    importZip
};
