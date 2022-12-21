"use strict";

const utils = require('../utils');
const becca = require("../../becca/becca");

function exportToOpml(taskContext, branch, version, res) {
    if (!['1.0', '2.0'].includes(version)) {
        throw new Error(`Unrecognized OPML version ${version}`);
    }

    const opmlVersion = parseInt(version);

    const note = branch.getNote();

    function exportNoteInner(branchId) {
        const branch = becca.getBranch(branchId);
        const note = branch.getNote();

        if (note.hasOwnedLabel('excludeFromExport')) {
            return;
        }

        const title = `${branch.prefix ? (`${branch.prefix} - `) : ''}${note.title}`;

        if (opmlVersion === 1) {
            const preparedTitle = escapeXmlAttribute(title);
            const preparedContent = note.isStringNote() ? prepareText(note.getContent()) : '';

            res.write(`<outline title="${preparedTitle}" text="${preparedContent}">\n`);
        }
        else if (opmlVersion === 2) {
            const preparedTitle = escapeXmlAttribute(title);
            const preparedContent = note.isStringNote() ? escapeXmlAttribute(note.getContent()) : '';

            res.write(`<outline text="${preparedTitle}" _note="${preparedContent}">\n`);
        }
        else {
            throw new Error(`Unrecognized OPML version ${opmlVersion}`);
        }

        taskContext.increaseProgressCount();

        for (const child of note.getChildBranches()) {
            exportNoteInner(child.branchId);
        }

        res.write('</outline>');
    }


    const filename = `${branch.prefix ? (`${branch.prefix} - `) : ''}${note.title}.opml`;

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    res.setHeader('Content-Type', 'text/x-opml');

    res.write(`<?xml version="1.0" encoding="UTF-8"?>
<opml version="${version}">
<head>
<title>Trilium export</title>
</head>
<body>`);

    exportNoteInner(branch.branchId);

    res.write(`</body>
</opml>`);
    res.end();

    taskContext.taskSucceeded();
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
