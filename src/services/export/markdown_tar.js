"use strict";

const tar = require('tar-stream');
const TurndownService = require('turndown');
const sanitize = require("sanitize-filename");
const markdownSingleExportService = require('../../services/export/markdown_single');

async function exportToMarkdown(branch, res) {
    const note = await branch.getNote();

    if (!await note.hasChildren()) {
        await markdownSingleExportService.exportSingleMarkdown(note, res);

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

module.exports = {
    exportToMarkdown
};