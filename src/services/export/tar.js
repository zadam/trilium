"use strict";

const html = require('html');
const tar = require('tar-stream');
const path = require('path');
const sanitize = require("sanitize-filename");
const mimeTypes = require('mime-types');
const TurndownService = require('turndown');

/**
 * @param format - 'html' or 'markdown'
 */
async function exportToTar(branch, format, res) {
    const turndownService = new TurndownService();

    // path -> number of occurences
    const existingPaths = {};

    const pack = tar.pack();

    const exportedNoteIds = [];
    const name = await exportNoteInner(branch, '');

    function getUniqueFilename(fileName) {
        const lcFileName = fileName.toLowerCase();

        if (lcFileName in existingPaths) {
            let index;
            let newName;

            do {
                index = existingPaths[lcFileName]++;

                newName = lcFileName + "_" + index;
            }
            while (newName in existingPaths);

            return fileName + "_" + index;
        }
        else {
            existingPaths[lcFileName] = 1;

            return fileName;
        }
    }

    async function exportNoteInner(branch, directory, existingNames) {
        const note = await branch.getNote();
        const baseFileName = getUniqueFilename(directory + sanitize(note.title));

        if (exportedNoteIds.includes(note.noteId)) {
            saveMetadataFile(baseFileName, {
                version: 1,
                clone: true,
                noteId: note.noteId,
                prefix: branch.prefix
            });

            return;
        }

        const metadata = {
            version: 1,
            clone: false,
            noteId: note.noteId,
            title: note.title,
            prefix: branch.prefix,
            isExpanded: branch.isExpanded,
            type: note.type,
            mime: note.mime,
            // we don't export dateCreated and dateModified of any entity since that would be a bit misleading
            attributes: (await note.getOwnedAttributes()).map(attribute => {
                return {
                    type: attribute.type,
                    name: attribute.name,
                    value: attribute.value,
                    isInheritable: attribute.isInheritable,
                    position: attribute.position
                };
            }),
            links: (await note.getLinks()).map(link => {
                return {
                    type: link.type,
                    targetNoteId: link.targetNoteId
                }
            })
        };

        if (note.type === 'text') {
            metadata.format = format;
        }

        if (await note.hasLabel('excludeFromExport')) {
            return;
        }

        metadata.dataFilename = saveDataFile(baseFileName, note);

        saveMetadataFile(baseFileName, metadata);

        exportedNoteIds.push(note.noteId);

        const childBranches = await note.getChildBranches();

        if (childBranches.length > 0) {
            saveDirectory(baseFileName);
        }

        for (const childBranch of childBranches) {
            await exportNoteInner(childBranch, baseFileName + "/");
        }

        return baseFileName;
    }

    function saveDataFile(baseFilename, note) {
        let content = note.content;
        let extension;

        if (note.type === 'text') {
            if (format === 'html') {
                content = html.prettyPrint(note.content, {indent_size: 2});
            }
            else if (format === 'markdown') {
                content = turndownService.turndown(note.content);
                extension = 'md';
            }
            else {
                throw new Error("Unknown format: " + format);
            }
        }

        if (!extension) {
            extension = mimeTypes.extension(note.mime)
                || getExceptionalExtension(note.mime)
                || "dat";
        }

        let filename = baseFilename;

        if (!filename.toLowerCase().endsWith(extension)) {
            filename += "." + extension;
        }

        filename = getUniqueFilename(filename);

        pack.entry({name: filename, size: content.length}, content);

        return path.basename(filename);
    }

    function getExceptionalExtension(mime) {
        if (mime === 'application/x-javascript') {
            return 'js';
        }
    }

    function saveMetadataFile(baseFileName, metadata) {
        const metadataJson = JSON.stringify(metadata, null, '\t');

        const fileName = getUniqueFilename(baseFileName + ".meta");

        pack.entry({name: fileName, size: metadataJson.length}, metadataJson);
    }

    function saveDirectory(baseFileName) {
        pack.entry({name: baseFileName, type: 'directory'});
    }

    pack.finalize();

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.tar"');
    res.setHeader('Content-Type', 'application/tar');

    pack.pipe(res);
}

module.exports = {
    exportToTar
};