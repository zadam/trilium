"use strict";

const sql = require('../../services/sql');
const html = require('html');
const tar = require('tar-stream');
const sanitize = require("sanitize-filename");
const repository = require("../../services/repository");
const utils = require('../../services/utils');

async function exportNote(req, res) {
    const noteId = req.params.noteId;
    const format = req.params.format;

    const branchId = await sql.getValue('SELECT branchId FROM branches WHERE noteId = ?', [noteId]);

    if (format === 'tar') {
        await exportToTar(branchId, res);
    }
    else if (format === 'opml') {
        await exportToOpml(branchId, res);
    }
    else {
        return [404, "Unrecognized export format " + format];
    }
}

function escapeXmlAttribute(text) {
    return text.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function prepareText(text) {
    const newLines = text.replace(/(<p[^>]*>|<br\s*\/?>)/g, '\n')
                         .replace(/&nbsp;/g, ' '); // nbsp isn't in XML standard (only HTML)

    const stripped = utils.stripTags(newLines);

    const escaped = escapeXmlAttribute(stripped);

    return escaped.replace(/\n/g, '&#10;');
}

async function exportToOpml(branchId, res) {
    const branch = await repository.getBranch(branchId);
    const note = await branch.getNote();
    const title = (branch.prefix ? (branch.prefix + ' - ') : '') + note.title;
    const sanitizedTitle = sanitize(title);

    async function exportNoteInner(branchId) {
        const branch = await repository.getBranch(branchId);
        const note = await branch.getNote();
        const title = (branch.prefix ? (branch.prefix + ' - ') : '') + note.title;

        const preparedTitle = prepareText(title);
        const preparedContent = prepareText(note.content);

        res.write(`<outline title="${preparedTitle}" text="${preparedContent}">\n`);

        for (const child of await note.getChildBranches()) {
            await exportNoteInner(child.branchId);
        }

        res.write('</outline>');
    }

    res.setHeader('Content-Disposition', 'file; filename="' + sanitizedTitle + '.opml"');
    res.setHeader('Content-Type', 'text/x-opml');

    res.write(`<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
<head>
<title>Trilium export</title>
</head>
<body>`);

    await exportNoteInner(branchId);

    res.write(`</body>
</opml>`);
    res.end();
}

async function exportToTar(branchId, res) {
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