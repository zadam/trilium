"use strict";

const sql = require('../../services/sql');
const html = require('html');
const tar = require('tar-stream');
const sanitize = require("sanitize-filename");
const repository = require("../../services/repository");

async function exportNote(req, res) {
    const noteId = req.params.noteId;

    const branchId = await sql.getValue('SELECT branchId FROM branches WHERE noteId = ?', [noteId]);

    const pack = tar.pack();

    const exportedNoteIds = [];
    const name = await exportNoteInner(branchId, '');

    async function exportNoteInner(branchId, directory) {
        const branch = await repository.getBranch(branchId);
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
            type: note.type,
            mime: note.mime,
            labels: (await note.getLabels()).map(label => {
                return {
                    name: label.name,
                    value: label.value
                };
            })
        };

        if (metadata.labels.find(label => label.name === 'excludeFromExport')) {
            return;
        }

        saveMetadataFile(childFileName, metadata);
        saveDataFile(childFileName, note);

        exportedNoteIds.push(note.noteId);

        for (const child of await note.getChildBranches()) {
            await exportNoteInner(child.branchId, childFileName + "/");
        }

        return childFileName;
    }

    function saveDataFile(childFileName, note) {
        const content = note.type === 'text' ? html.prettyPrint(note.content, {indent_size: 2}) : note.content;

        pack.entry({name: childFileName + ".dat", size: content.length}, content);
    }

    function saveMetadataFile(childFileName, metadata) {
        const metadataJson = JSON.stringify(metadata, null, '\t');

        pack.entry({name: childFileName + ".meta", size: metadataJson.length}, metadataJson);
    }

    pack.finalize();

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.tar"');
    res.setHeader('Content-Type', 'application/tar');

    pack.pipe(res);
}

module.exports = {
    exportNote
};