"use strict";

const html = require('html');
const native_tar = require('tar-stream');
const sanitize = require("sanitize-filename");
const mimeTypes = require('mime-types');
const TurndownService = require('turndown');

/**
 * @param format - 'html' or 'markdown'
 */
async function exportToTar(branch, format, res) {
    const turndownService = new TurndownService();

    const pack = native_tar.pack();

    const exportedNoteIds = [];
    const name = await exportNoteInner(branch, '');

    async function exportNoteInner(branch, directory) {
        const note = await branch.getNote();
        const childFileName = directory + sanitize(note.title);

        if (exportedNoteIds.includes(note.noteId)) {
            saveMetadataFile(childFileName, {
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

        saveMetadataFile(childFileName, metadata);
        saveDataFile(childFileName, note);

        exportedNoteIds.push(note.noteId);

        const childBranches = await note.getChildBranches();

        if (childBranches.length > 0) {
            saveDirectory(childFileName);
        }

        for (const childBranch of childBranches) {
            await exportNoteInner(childBranch, childFileName + "/");
        }

        return childFileName;
    }

    function saveDataFile(childFileName, note) {
        let content = note.content;

        if (note.type === 'text') {
            if (format === 'html') {
                content = html.prettyPrint(note.content, {indent_size: 2});
            }
            else if (format === 'markdown') {
                content = turndownService.turndown(note.content);
            }
            else {
                throw new Error("Unknown format: " + format);
            }
        }

        const extension = mimeTypes.extension(note.mime)
            || getExceptionalExtension(note.mime)
            || "dat";

        if (!childFileName.toLowerCase().endsWith(extension)) {
            childFileName += "." + extension;
        }

        pack.entry({name: childFileName, size: content.length}, content);
    }

    function getExceptionalExtension(mime) {
        if (mime === 'application/x-javascript') {
            return 'js';
        }
    }

    function saveMetadataFile(childFileName, metadata) {
        const metadataJson = JSON.stringify(metadata, null, '\t');

        pack.entry({name: childFileName + ".meta", size: metadataJson.length}, metadataJson);
    }

    function saveDirectory(childFileName) {
        pack.entry({name: childFileName, type: 'directory'});
    }

    pack.finalize();

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.tar"');
    res.setHeader('Content-Type', 'application/tar');

    pack.pipe(res);
}

module.exports = {
    exportToTar
};