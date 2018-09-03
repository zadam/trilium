"use strict";

const html = require('html');
const tar = require('tar-stream');
const sanitize = require("sanitize-filename");
const repository = require("../../services/repository");
const utils = require('../../services/utils');
const TurndownService = require('turndown');

async function exportNote(req, res) {
    // entityId maybe either noteId or branchId depending on format
    const entityId = req.params.entityId;
    const format = req.params.format;

    if (format === 'tar') {
        await exportToTar(await repository.getBranch(entityId), res);
    }
    else if (format === 'opml') {
        await exportToOpml(await repository.getBranch(entityId), res);
    }
    else if (format === 'markdown') {
        await exportToMarkdown(await repository.getBranch(entityId), res);
    }
    // export single note without subtree
    else if (format === 'markdown-single') {
        await exportSingleMarkdown(await repository.getNote(entityId), res);
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

async function exportToOpml(branch, res) {
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

    await exportNoteInner(branch.branchId);

    res.write(`</body>
</opml>`);
    res.end();
}

async function exportToTar(branch, res) {
    const pack = tar.pack();

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
            type: note.type,
            mime: note.mime,
            attributes: (await note.getOwnedAttributes()).map(attribute => {
                return {
                    type: attribute.type,
                    name: attribute.name,
                    value: attribute.value,
                    isInheritable: attribute.isInheritable,
                    position: attribute.position
                };
            })
        };

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
        const content = note.type === 'text' ? html.prettyPrint(note.content, {indent_size: 2}) : note.content;

        pack.entry({name: childFileName + ".dat", size: content.length}, content);
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

async function exportToMarkdown(branch, res) {
    const note = await branch.getNote();

    if (!await note.hasChildren()) {
        await exportSingleMarkdown(note, res);

        return;
    }

    const turndownService = new TurndownService();
    const pack = tar.pack();
    const name = await exportNoteInner(note, '');

    async function exportNoteInner(note, directory) {
        const childFileName = directory + sanitize(note.title);

        if (await note.hasLabel('excludeFromExport')) {
            return;
        }

        saveDataFile(childFileName, note);

        const childNotes = await note.getChildNotes();

        if (childNotes.length > 0) {
            saveDirectory(childFileName);
        }

        for (const childNote of childNotes) {
            await exportNoteInner(childNote, childFileName + "/");
        }

        return childFileName;
    }

    function saveDataFile(childFileName, note) {
        if (note.type !== 'text' && note.type !== 'code') {
            return;
        }

        if (note.content.trim().length === 0) {
            return;
        }

        let markdown;

        if (note.type === 'code') {
            markdown = '```\n' + note.content + "\n```";
        }
        else if (note.type === 'text') {
            markdown = turndownService.turndown(note.content);
        }
        else {
            // other note types are not supported
            return;
        }

        pack.entry({name: childFileName + ".md", size: markdown.length}, markdown);
    }

    function saveDirectory(childFileName) {
        pack.entry({name: childFileName, type: 'directory'});
    }

    pack.finalize();

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.tar"');
    res.setHeader('Content-Type', 'application/tar');

    pack.pipe(res);
}

async function exportSingleMarkdown(note, res) {
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(note.content);
    const name = sanitize(note.title);

    res.setHeader('Content-Disposition', 'file; filename="' + name + '.md"');
    res.setHeader('Content-Type', 'text/markdown; charset=UTF-8');

    res.send(markdown);
}

module.exports = {
    exportNote
};