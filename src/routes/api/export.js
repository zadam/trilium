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

    const name = await exportNoteInner(branchId, '', pack);

    pack.finalize();

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.tar"');
    res.setHeader('Content-Type', 'application/tar');

    pack.pipe(res);
}

async function exportNoteInner(branchId, directory, pack) {
    const branch = await repository.getBranch(branchId);
    const note = await branch.getNote();

    if (note.isProtected) {
        return;
    }

    const metadata = await getMetadata(note);

    if (metadata.labels.find(label => label.name === 'excludeFromExport')) {
        return;
    }

    const metadataJson = JSON.stringify(metadata, null, '\t');
    const childFileName = directory + sanitize(note.title);

    pack.entry({ name: childFileName + ".meta", size: metadataJson.length }, metadataJson);

    const content = note.type === 'text' ? html.prettyPrint(note.content, {indent_size: 2}) : note.content;

    pack.entry({ name: childFileName + ".dat", size: content.length }, content);

    for (const child of await note.getChildBranches()) {
        await exportNoteInner(child.branchId, childFileName + "/", pack);
    }

    return childFileName;
}

async function getMetadata(note) {
    return {
        version: 1,
        title: note.title,
        type: note.type,
        mime: note.mime,
        labels: (await note.getLabels()).map(label => {
            return {
                name: label.name,
                value: label.value
            };
        })
    };
}

module.exports = {
    exportNote
};