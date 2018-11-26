"use strict";

const Attribute = require('../../entities/attribute');
const Link = require('../../entities/link');
const utils = require('../../services/utils');
const repository = require('../../services/repository');
const noteService = require('../../services/notes');
const Branch = require('../../entities/branch');
const tar = require('tar-stream');
const stream = require('stream');
const path = require('path');
const commonmark = require('commonmark');
const mimeTypes = require('mime-types');

async function importTar(fileBuffer, importRootNote) {
    // maps from original noteId (in tar file) to newly generated noteId
    const noteIdMap = {};
    // path => noteId
    const createdPaths = { '/': importRootNote.noteId, '\\': importRootNote.noteId };
    const mdReader = new commonmark.Parser();
    const mdWriter = new commonmark.HtmlRenderer();
    let metaFile = null;
    let firstNote = null;

    const extract = tar.extract();

    function getNewNoteId(origNoteId) {
        // in case the original noteId is empty. This probably shouldn't happen, but still good to have this precaution
        if (!origNoteId.trim()) {
            return "";
        }

        // we allow references to root and they don't need translation
        if (origNoteId === 'root') {
            return origNoteId;
        }

        if (!noteIdMap[origNoteId]) {
            noteIdMap[origNoteId] = utils.newEntityId();
        }

        return noteIdMap[origNoteId];
    }
    
    function getMeta(filePath) {
        if (!metaFile) {
            return;
        }

        const pathSegments = filePath.split(/[\/\\]/g);

        let cursor = { children: metaFile.files };
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

    function getParentNoteId(filePath, parentNoteMeta, noteMeta) {
        let parentNoteId;

        if (noteMeta) {
            if (parentNoteMeta) {
                parentNoteId = getNewNoteId(parentNoteMeta.noteId);
            }
            else {
                parentNoteId = importRootNote.noteId;
            }
        }
        else {
            const parentPath = path.dirname(filePath);

            if (parentPath in createdPaths) {
                parentNoteId = createdPaths[parentPath];
            }
            else {
                throw new Error(`Could not find existing path ${parentPath}.`);
            }
        }

        return parentNoteId;
    }

    function getNoteTitle(filePath, noteMeta) {
        if (noteMeta) {
            return noteMeta.title;
        }
        else {
            const basename = path.basename(filePath);

            return getTextFileWithoutExtension(basename);
        }
    }

    function getNoteId(noteMeta, filePath) {
        if (noteMeta) {
            return getNewNoteId(noteMeta.noteId);
        }
        else {
            const filePathNoExt = getTextFileWithoutExtension(filePath);

            if (filePathNoExt in createdPaths) {
                return createdPaths[filePathNoExt];
            }
            else {
                return utils.newEntityId();
            }
        }
    }

    function detectFileTypeAndMime(filePath) {
        const mime = mimeTypes.lookup(filePath);
        let type = 'file';

        if (mime) {
            if (mime === 'text/html' || mime === 'text/markdown') {
                type = 'text';
            }
            else if (mime.startsWith('image/')) {
                type = 'image';
            }
        }

        return { type, mime };
    }

    async function saveAttributes(note, noteMeta) {
        if (!noteMeta) {
            return;
        }

        for (const attr of noteMeta.attributes) {
            if (attr.type === 'relation') {
                attr.value = getNewNoteId(attr.value);
            }

            await new Attribute(attr).save();
        }

        for (const link of noteMeta.links) {
            link.targetNoteId = getNewNoteId(link.targetNoteId);

            await new Link(link).save();
        }
    }

    async function saveDirectory(filePath) {
        // directory entries in tar often end with directory separator
        filePath = (filePath.endsWith("/") || filePath.endsWith("\\")) ? filePath.substr(0, filePath.length - 1) : filePath;

        const { parentNoteMeta, noteMeta } = getMeta(filePath);

        const noteId = getNoteId(noteMeta, filePath);
        const noteTitle = getNoteTitle(filePath, noteMeta);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta, noteMeta);

        const {note} = await noteService.createNote(parentNoteId, noteTitle, '', {
            noteId,
            type: noteMeta ? noteMeta.type : 'text',
            mime: noteMeta ? noteMeta.mime : 'text/html',
            prefix: noteMeta ? noteMeta.prefix : '',
            isExpanded: noteMeta ? noteMeta.isExpanded : false
        });

        await saveAttributes(note, noteMeta);

        if (!firstNote) {
            firstNote = note;
        }

        createdPaths[filePath] = noteId;
    }

    function getTextFileWithoutExtension(filePath) {
        const extension = path.extname(filePath).toLowerCase();

        if (extension === '.md' || extension === '.html') {
            return filePath.substr(0, filePath.length - extension.length);
        }
        else {
            return filePath;
        }
    }

    async function saveNote(filePath, content) {
        const {parentNoteMeta, noteMeta} = getMeta(filePath);

        const noteId = getNoteId(noteMeta, filePath);
        const parentNoteId = getParentNoteId(filePath, parentNoteMeta, noteMeta);

        if (noteMeta && noteMeta.isClone) {
            await new Branch({
                noteId,
                parentNoteId,
                isExpanded: noteMeta.isExpanded,
                prefix: noteMeta.prefix
            }).save();

            return;
        }

        const {type, mime} = noteMeta ? noteMeta : detectFileTypeAndMime(filePath);

        if (type === 'text') {
            content = content.toString("UTF-8");
        }

        if ((noteMeta && noteMeta.format === 'markdown') || (!noteMeta && mime === 'text/markdown')) {
            const parsed = mdReader.parse(content);
            content = mdWriter.render(parsed);
        }

        let note = await repository.getNote(noteId);

        if (!note) {
            const noteTitle = getNoteTitle(filePath, noteMeta);

            ({note} = await noteService.createNote(parentNoteId, noteTitle, content, {
                noteId,
                type,
                mime,
                prefix: noteMeta ? noteMeta.prefix : '',
                isExpanded: noteMeta ? noteMeta.isExpanded : false
            }));

            await saveAttributes(note, noteMeta);

            if (!firstNote) {
                firstNote = note;
            }

            if (type === 'text') {
                filePath = getTextFileWithoutExtension(filePath);
            }

            createdPaths[filePath] = noteId;
        }
        else {
            note.content = content;
            await note.save();
        }
    }

    extract.on('entry', function(header, stream, next) {
        const chunks = [];

        stream.on("data", function (chunk) {
            chunks.push(chunk);
        });

        // header is the tar header
        // stream is the content body (might be an empty stream)
        // call next when you are done with this entry

        stream.on('end', async function() {
            const filePath = header.name;
            const content = Buffer.concat(chunks);

            if (filePath === '!!!meta.json') {
                metaFile = JSON.parse(content.toString("UTF-8"));
            }
            else if (header.type === 'directory') {
                await saveDirectory(filePath);
            }
            else {
                await saveNote(filePath, content);
            }

            next(); // ready for next entry
        });

        stream.resume(); // just auto drain the stream
    });

    return new Promise(resolve => {
        extract.on('finish', function() {
            resolve(firstNote);
        });

        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        bufferStream.pipe(extract);
    });
}

module.exports = {
    importTar
};