"use strict";

const repository = require("../repository");
const utils = require('../utils');

async function exportToOpml(branch, res) {
    const note = await branch.getNote();

    async function exportNoteInner(branchId) {
        const branch = await repository.getBranch(branchId);
        const note = await branch.getNote();

        if (await note.hasLabel('excludeFromExport')) {
            return;
        }

        const title = (branch.prefix ? (branch.prefix + ' - ') : '') + note.title;

        const preparedTitle = prepareText(title);
        const preparedContent = prepareText(note.content);

        res.write(`<outline title="${preparedTitle}" text="${preparedContent}">\n`);

        for (const child of await note.getChildBranches()) {
            await exportNoteInner(child.branchId);
        }

        res.write('</outline>');
    }

    const filename = (branch.prefix ? (branch.prefix + ' - ') : '') + note.title + ".opml";

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
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

function prepareText(text) {
    const newLines = text.replace(/(<p[^>]*>|<br\s*\/?>)/g, '\n')
        .replace(/&nbsp;/g, ' '); // nbsp isn't in XML standard (only HTML)

    const stripped = utils.stripTags(newLines);

    const escaped = escapeXmlAttribute(stripped);

    return escaped.replace(/\n/g, '&#10;');
}

function escapeXmlAttribute(text) {
    return text.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    exportToOpml
};