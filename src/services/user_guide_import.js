"use strict"

const becca = require("../becca/becca");
const fs = require("fs").promises;
const BAttribute = require('../becca/entities/battribute');
const utils = require('./utils');
const log = require('./log');
const noteService = require('./notes');
const attributeService = require('./attributes');
const BBranch = require('../becca/entities/bbranch');
const path = require('path');
const yauzl = require("yauzl");
const htmlSanitizer = require('./html_sanitizer');
const sql = require('./sql');
const options = require('./options');
const {USER_GUIDE_ZIP_DIR} = require('./resource_dir');

async function importUserGuideIfNeeded() {
    const userGuideSha256HashInDb = options.getOption('userGuideSha256Hash');
    let userGuideSha256HashInFile = await fs.readFile(USER_GUIDE_ZIP_DIR + "/user-guide.zip.sha256");

    if (!userGuideSha256HashInFile || userGuideSha256HashInFile.byteLength < 64) {
        return;
    }

    userGuideSha256HashInFile = userGuideSha256HashInFile.toString().substr(0, 64);

    if (userGuideSha256HashInDb === userGuideSha256HashInFile) {
        // user guide ZIP file has been already imported and is up-to-date
        return;
    }

    const hiddenRoot = becca.getNote("_hidden");
    const data = await fs.readFile(USER_GUIDE_ZIP_DIR + "/user-guide.zip", "binary");

    await importZip(Buffer.from(data, 'binary'), hiddenRoot);

    options.setOption('userGuideSha256Hash', userGuideSha256HashInFile);
}

async function importZip(fileBuffer, importRootNote) {
    // maps from original noteId (in ZIP file) to newly generated noteId
    const noteIdMap = {};
    const attributes = [];
    let metaFile = null;

    function getNewNoteId(origNoteId) {
        if (origNoteId === 'root' || origNoteId.startsWith("_")) {
            // these "named" noteIds don't differ between Trilium instances
            return origNoteId;
        }

        if (!noteIdMap[origNoteId]) {
            noteIdMap[origNoteId] = utils.newEntityId();
        }

        return noteIdMap[origNoteId];
    }

    function getMeta(filePath) {
        const pathSegments = filePath.split(/[\/\\]/g);

        let cursor = {
            isImportRoot: true,
            children: metaFile.files
        };

        let parent;

        for (const segment of pathSegments) {
            if (!cursor || !cursor.children || cursor.children.length === 0) {
                throw new Error(`Note meta for '${filePath}' not found.`);
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
        return parentNoteMeta.isImportRoot ? importRootNote.noteId : getNewNoteId(parentNoteMeta.noteId);
    }

    function getNoteId(noteMeta) {
        let userGuideNoteId = noteMeta.attributes?.find(attr => attr.type === 'label' && attr.name === 'helpNoteId')?.value;

        userGuideNoteId = '_userGuide' + noteMeta.title.replace(/[^a-z0-9]/ig, '');

        if (noteMeta.title.trim() === 'User Guide') {
            userGuideNoteId = '_userGuide';
        }

        const noteId = userGuideNoteId || noteMeta.noteId;
        noteIdMap[noteMeta.noteId] = noteId;

        return noteId;
    }

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

            attributes.push(attr);
        }
    }

    function saveDirectory(filePath) {
        const { parentNoteMeta, noteMeta } = getMeta(filePath);

        const noteId = getNoteId(noteMeta);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta);

        let note = becca.getNote(noteId);

        if (note) {
            return;
        }

        ({note} = noteService.createNewNote({
            parentNoteId: parentNoteId,
            title: noteMeta.title,
            content: '',
            noteId: noteId,
            type: noteMeta.type,
            mime: noteMeta.mime,
            prefix: noteMeta.prefix,
            isExpanded: noteMeta.isExpanded,
            notePosition: noteMeta.notePosition,
            isProtected: false,
            ignoreForbiddenParents: true
        }));

        saveAttributes(note, noteMeta);

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

        absUrl += `${absUrl.length > 0 ? '/' : ''}${url}`;

        const {noteMeta} = getMeta(absUrl);
        const targetNoteId = getNoteId(noteMeta);
        return targetNoteId;
    }

    function processTextNoteContent(content, filePath, noteMeta) {
        function isUrlAbsolute(url) {
            return /^(?:[a-z]+:)?\/\//i.test(url);
        }

        content = content.replace(/<h1>([^<]*)<\/h1>/gi, (match, text) => {
            if (noteMeta.title.trim() === text.trim()) {
                return ""; // remove whole H1 tag
            } else {
                return `<h2>${text}</h2>`;
            }
        });

        content = htmlSanitizer.sanitize(content);

        content = content.replace(/<html.*<body[^>]*>/gis, "");
        content = content.replace(/<\/body>.*<\/html>/gis, "");

        content = content.replace(/src="([^"]*)"/g, (match, url) => {
            try {
                url = decodeURIComponent(url);
            } catch (e) {
                log.error(`Cannot parse image URL '${url}', keeping original (${e}).`);
                return `src="${url}"`;
            }

            if (isUrlAbsolute(url) || url.startsWith("/")) {
                return match;
            }

            const targetNoteId = getNoteIdFromRelativeUrl(url, filePath);

            return `src="api/images/${targetNoteId}/${path.basename(url)}"`;
        });

        content = content.replace(/href="([^"]*)"/g, (match, url) => {
            try {
                url = decodeURIComponent(url);
            } catch (e) {
                log.error(`Cannot parse link URL '${url}', keeping original (${e}).`);
                return `href="${url}"`;
            }

            if (url.startsWith('#') // already a note path (probably)
                || isUrlAbsolute(url)) {
                return match;
            }

            const targetNoteId = getNoteIdFromRelativeUrl(url, filePath);

            return `href="#root/${targetNoteId}"`;
        });

        content = content.replace(/data-note-path="([^"]*)"/g, (match, notePath) => {
            const noteId = notePath.split("/").pop();

            let targetNoteId;

            if (noteId === 'root' || noteId.startsWith("_")) { // named noteIds stay identical across instances
                targetNoteId = noteId;
            } else {
                targetNoteId = noteIdMap[noteId];
            }

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
        return content;
    }

    function processNoteContent(noteMeta, type, mime, content, filePath) {
        if (type === 'text') {
            content = processTextNoteContent(content, filePath, noteMeta);
        }

        if (type === 'relationMap') {
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

    function saveNote(filePath, content) {
        const {parentNoteMeta, noteMeta} = getMeta(filePath);

        if (noteMeta?.noImport) {
            return;
        }

        const noteId = getNoteId(noteMeta);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta);

        if (!parentNoteId) {
            throw new Error(`Cannot find parentNoteId for ${filePath}`);
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

        let {type, mime} = noteMeta;

        if (type !== 'file' && type !== 'image') {
            content = content.toString("UTF-8");
        }

        content = processNoteContent(noteMeta, type, mime, content, filePath);

        let note = becca.getNote(noteId);

        if (note) {
            // only skeleton was created because of altered order of cloned notes in ZIP, we need to update
            // https://github.com/zadam/trilium/issues/2440
            if (note.type === undefined) {
                note.type = type;
                note.mime = mime;
                note.title = noteMeta.title;
                note.isProtected = false;
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
                title: noteMeta.title,
                content: content,
                noteId,
                type,
                mime,
                prefix: noteMeta.prefix,
                isExpanded: noteMeta.isExpanded,
                notePosition: noteMeta.notePosition,
                isProtected: false,
                ignoreForbiddenParents: true
            }));

            saveAttributes(note, noteMeta);
        }
    }

    const entries = [];

    await readZipFile(fileBuffer, async (zipfile, entry) => {
        const filePath = normalizeFilePath(entry.fileName);

        if (/\/$/.test(entry.fileName)) {
            entries.push({
                type: 'directory',
                filePath
            });
        }
        else {
            entries.push({
                type: 'file',
                filePath,
                content: await readContent(zipfile, entry)
            });
        }

        zipfile.readEntry();
    });

    metaFile = JSON.parse(entries.find(entry => entry.type === 'file' && entry.filePath === '!!!meta.json').content);

    sql.transactional(() => {
        deleteUserGuideSubtree();

        for (const {type, filePath, content} of entries) {
            if (type === 'directory') {
                saveDirectory(filePath);
            } else if (type === 'file') {
                if (filePath === '!!!meta.json') {
                    continue;
                }

                saveNote(filePath, content);
            } else {
                throw new Error(`Unknown type ${type}`)
            }
        }
    });

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
}

/**
 * This is a special implementation of deleting the subtree, because we want to preserve the links to the user guide pages
 * and clones.
 */
function deleteUserGuideSubtree() {
    const DELETE_ID = 'user-guide';

    function remove(branch) {
        branch.markAsDeleted(DELETE_ID);

        const note = becca.getNote(branch.noteId);

        for (const branch of note.getChildBranches()) {
            remove(branch);
        }

        note.getOwnedAttributes().forEach(attr => attr.markAsDeleted(DELETE_ID));

        note.markAsDeleted(DELETE_ID)
    }

    remove(becca.getBranchFromChildAndParent('_userGuide', '_hidden'));
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

module.exports = {
    importUserGuideIfNeeded
};
