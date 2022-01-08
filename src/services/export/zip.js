"use strict";

const html = require('html');
const dateUtils = require('../date_utils');
const path = require('path');
const mimeTypes = require('mime-types');
const mdService = require('./md');
const packageInfo = require('../../../package.json');
const utils = require('../utils');
const protectedSessionService = require('../protected_session');
const sanitize = require("sanitize-filename");
const fs = require("fs");
const becca = require("../../becca/becca");
const RESOURCE_DIR = require('../../services/resource_dir').RESOURCE_DIR;
const archiver = require('archiver');

/**
 * @param {TaskContext} taskContext
 * @param {Branch} branch
 * @param {string} format - 'html' or 'markdown'
 */
function exportToZip(taskContext, branch, format, res) {
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    const noteIdToMeta = {};

    function getUniqueFilename(existingFileNames, fileName) {
        const lcFileName = fileName.toLowerCase();

        if (lcFileName in existingFileNames) {
            let index;
            let newName;

            do {
                index = existingFileNames[lcFileName]++;

                newName = index + "_" + lcFileName;
            }
            while (newName in existingFileNames);

            return index + "_" + fileName;
        }
        else {
            existingFileNames[lcFileName] = 1;

            return fileName;
        }
    }

    function getDataFileName(note, baseFileName, existingFileNames) {
        let fileName = baseFileName;

        if (fileName.length > 30) {
            fileName = fileName.substr(0, 30);
        }

        let existingExtension = path.extname(fileName).toLowerCase();
        let newExtension;

        // following two are handled specifically since we always want to have these extensions no matter the automatic detection
        // and/or existing detected extensions in the note name
        if (note.type === 'text' && format === 'markdown') {
            newExtension = 'md';
        }
        else if (note.type === 'text' && format === 'html') {
            newExtension = 'html';
        }
        else if (note.mime === 'application/x-javascript' || note.mime === 'text/javascript') {
            newExtension = 'js';
        }
        else if (existingExtension.length > 0) { // if the page already has an extension, then we'll just keep it
            newExtension = null;
        }
        else {
            if (note.mime?.toLowerCase()?.trim() === "image/jpg") {
                newExtension = 'jpg';
            }
            else {
                newExtension = mimeTypes.extension(note.mime) || "dat";
            }
        }

        // if the note is already named with extension (e.g. "jquery"), then it's silly to append exact same extension again
        if (newExtension && existingExtension !== "." + newExtension.toLowerCase()) {
            fileName += "." + newExtension;
        }

        return getUniqueFilename(existingFileNames, fileName);
    }

    function getNoteMeta(branch, parentMeta, existingFileNames) {
        const note = branch.getNote();

        if (note.hasOwnedLabel('excludeFromExport')) {
            return;
        }

        const title = note.getTitleOrProtected();
        const completeTitle = branch.prefix ? (branch.prefix + ' - ' + title) : title;
        let baseFileName = sanitize(completeTitle);

        if (baseFileName.length > 200) { // actual limit is 256 bytes(!) but let's be conservative
            baseFileName = baseFileName.substr(0, 200);
        }

        const notePath = parentMeta.notePath.concat([note.noteId]);

        if (note.noteId in noteIdToMeta) {
            const fileName = getUniqueFilename(existingFileNames, baseFileName + ".clone." + (format === 'html' ? 'html' : 'md'));

            return {
                isClone: true,
                noteId: note.noteId,
                notePath: notePath,
                title: note.getTitleOrProtected(),
                prefix: branch.prefix,
                dataFileName: fileName,
                type: 'text', // export will have text description,
                format: format
            };
        }

        const meta = {
            isClone: false,
            noteId: note.noteId,
            notePath: notePath,
            title: note.getTitleOrProtected(),
            notePosition: branch.notePosition,
            prefix: branch.prefix,
            isExpanded: branch.isExpanded,
            type: note.type,
            mime: note.mime,
            // we don't export utcDateCreated and utcDateModified of any entity since that would be a bit misleading
            attributes: note.getOwnedAttributes().map(attribute => ({
                    type: attribute.type,
                    name: attribute.name,
                    value: attribute.value,
                    isInheritable: attribute.isInheritable,
                    position: attribute.position
            }))
        };

        taskContext.increaseProgressCount();

        if (note.type === 'text') {
            meta.format = format;
        }

        noteIdToMeta[note.noteId] = meta;

        const childBranches = note.getChildBranches();

        const available = !note.isProtected || protectedSessionService.isProtectedSessionAvailable();

        // if it's a leaf then we'll export it even if it's empty
        if (available && (note.getContent().length > 0 || childBranches.length === 0)) {
            meta.dataFileName = getDataFileName(note, baseFileName, existingFileNames);
        }

        if (childBranches.length > 0) {
            meta.dirFileName = getUniqueFilename(existingFileNames, baseFileName);
            meta.children = [];

            // namespace is shared by children in the same note
            const childExistingNames = {};

            for (const childBranch of childBranches) {
                const note = getNoteMeta(childBranch, meta, childExistingNames);

                // can be undefined if export is disabled for this note
                if (note) {
                    meta.children.push(note);
                }
            }
        }

        return meta;
    }

    function getTargetUrl(targetNoteId, sourceMeta) {
        const targetMeta = noteIdToMeta[targetNoteId];

        if (!targetMeta) {
            return null;
        }

        const targetPath = targetMeta.notePath.slice();
        const sourcePath = sourceMeta.notePath.slice();

        // > 1 for edge case that targetPath and sourcePath are exact same (link to itself)
        while (targetPath.length > 1 && sourcePath.length > 1 && targetPath[0] === sourcePath[0]) {
            targetPath.shift();
            sourcePath.shift();
        }

        let url = "../".repeat(sourcePath.length - 1);

        for (let i = 0; i < targetPath.length - 1; i++) {
            const meta = noteIdToMeta[targetPath[i]];

            url += encodeURIComponent(meta.dirFileName) + '/';
        }

        const meta = noteIdToMeta[targetPath[targetPath.length - 1]];

        // link can target note which is only "folder-note" and as such will not have a file in an export
        url += encodeURIComponent(meta.dataFileName || meta.dirFileName);

        return url;
    }

    function findLinks(content, noteMeta) {
        content = content.replace(/src="[^"]*api\/images\/([a-zA-Z0-9]+)\/[^"]*"/g, (match, targetNoteId) => {
            const url = getTargetUrl(targetNoteId, noteMeta);

            return url ? `src="${url}"` : match;
        });

        content = content.replace(/href="[^"]*#root[a-zA-Z0-9\/]*\/([a-zA-Z0-9]+)\/?"/g, (match, targetNoteId) => {
            const url = getTargetUrl(targetNoteId, noteMeta);

            return url ? `href="${url}"` : match;
        });

        return content;
    }

    function prepareContent(title, content, noteMeta) {
        if (['html', 'markdown'].includes(noteMeta.format)) {
            content = content.toString();

            content = findLinks(content, noteMeta);
        }

        if (noteMeta.format === 'html') {
            if (!content.substr(0, 100).toLowerCase().includes("<html")) {
                const cssUrl = "../".repeat(noteMeta.notePath.length - 1) + 'style.css';

                // <base> element will make sure external links are openable - https://github.com/zadam/trilium/issues/1289#issuecomment-704066809
                content = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="${cssUrl}">
    <base target="_parent">
</head>
<body class="ck-content">
  <h1>${utils.escapeHtml(title)}</h1>
${content}
</body>
</html>`;
            }

            return html.prettyPrint(content, {indent_size: 2});
        }
        else if (noteMeta.format === 'markdown') {
            let markdownContent = mdService.toMarkdown(content);

            if (markdownContent.trim().length > 0 && !markdownContent.startsWith("# ")) {
                markdownContent = '# ' + title + "\r\n" + markdownContent;
            }

            return markdownContent;
        }
        else {
            return content;
        }
    }

    // noteId => file path
    const notePaths = {};

    function saveNote(noteMeta, filePathPrefix) {
        if (noteMeta.isClone) {
            const targetUrl = getTargetUrl(noteMeta.noteId, noteMeta);

            let content = `<p>This is a clone of a note. Go to its <a href="${targetUrl}">primary location</a>.</p>`;

            content = prepareContent(noteMeta.title, content, noteMeta);

            archive.append(content, { name: filePathPrefix + noteMeta.dataFileName });

            return;
        }

        const note = becca.getNote(noteMeta.noteId);

        notePaths[note.noteId] = filePathPrefix + (noteMeta.dataFileName || noteMeta.dirFileName);

        if (noteMeta.dataFileName) {
            const content = prepareContent(noteMeta.title, note.getContent(), noteMeta);

            archive.append(content, { name: filePathPrefix + noteMeta.dataFileName, date: dateUtils.parseDateTime(note.utcDateModified) });
        }

        taskContext.increaseProgressCount();

        if (noteMeta.children && noteMeta.children.length > 0) {
            const directoryPath = filePathPrefix + noteMeta.dirFileName;

            // create directory
            archive.append('', { name: directoryPath + '/', date: dateUtils.parseDateTime(note.utcDateModified) });

            for (const childMeta of noteMeta.children) {
                saveNote(childMeta, directoryPath + '/');
            }
        }
    }

    function saveNavigation(rootMeta, navigationMeta) {
        function saveNavigationInner(meta) {
            let html = '<li>';

            const escapedTitle = utils.escapeHtml((meta.prefix ? `${meta.prefix} - ` : '') + meta.title);

            if (meta.dataFileName) {
                const targetUrl = getTargetUrl(meta.noteId, rootMeta);

                html += `<a href="${targetUrl}" target="detail">${escapedTitle}</a>`;
            }
            else {
                html += escapedTitle;
            }

            if (meta.children && meta.children.length > 0) {
                html += '<ul>';

                for (const child of meta.children) {
                    html += saveNavigationInner(child);
                }

                html += '</ul>'
            }

            return html + '</li>';
        }

        const fullHtml = `<html>
<head>
    <meta charset="utf-8">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <ul>${saveNavigationInner(rootMeta)}</ul>
</body>
</html>`;
        const prettyHtml = html.prettyPrint(fullHtml, {indent_size: 2});

        archive.append(prettyHtml, { name: navigationMeta.dataFileName });
    }

    function saveIndex(rootMeta, indexMeta) {
        let firstNonEmptyNote;
        let curMeta = rootMeta;

        while (!firstNonEmptyNote) {
            if (curMeta.dataFileName) {
                firstNonEmptyNote = getTargetUrl(curMeta.noteId, rootMeta);
            }

            if (curMeta.children && curMeta.children.length > 0) {
                curMeta = curMeta.children[0];
            }
            else {
                break;
            }
        }

        const fullHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<frameset cols="25%,75%">
    <frame name="navigation" src="navigation.html">
    <frame name="detail" src="${firstNonEmptyNote}">
</frameset>
</html>`;

        archive.append(fullHtml, { name: indexMeta.dataFileName });
    }

    function saveCss(rootMeta, cssMeta) {
        const cssContent = fs.readFileSync(RESOURCE_DIR + '/libraries/ckeditor/ckeditor-content.css');

        archive.append(cssContent, { name: cssMeta.dataFileName });
    }

    const existingFileNames = format === 'html' ? ['navigation', 'index'] : [];
    const rootMeta = getNoteMeta(branch, { notePath: [] }, existingFileNames);

    const metaFile = {
        formatVersion: 1,
        appVersion: packageInfo.version,
        files: [ rootMeta ]
    };

    let navigationMeta, indexMeta, cssMeta;

    if (format === 'html') {
        navigationMeta = {
            noImport: true,
            dataFileName: "navigation.html"
        };

        metaFile.files.push(navigationMeta);

        indexMeta = {
            noImport: true,
            dataFileName: "index.html"
        };

        metaFile.files.push(indexMeta);

        cssMeta = {
            noImport: true,
            dataFileName: "style.css"
        };

        metaFile.files.push(cssMeta);
    }

    for (const noteMeta of Object.values(noteIdToMeta)) {
        // filter out relations which are not inside this export
        noteMeta.attributes = noteMeta.attributes.filter(attr => attr.type !== 'relation' || attr.value in noteIdToMeta);
    }

    if (!rootMeta) { // corner case of disabled export for exported note
        res.sendStatus(400);
        return;
    }

    const metaFileJson = JSON.stringify(metaFile, null, '\t');

    archive.append(metaFileJson, { name: "!!!meta.json" });

    saveNote(rootMeta, '');

    if (format === 'html') {
        saveNavigation(rootMeta, navigationMeta);
        saveIndex(rootMeta, indexMeta);
        saveCss(rootMeta, cssMeta);
    }

    const note = branch.getNote();
    const zipFileName = (branch.prefix ? `${branch.prefix} - ` : "") + note.getTitleOrProtected() + ".zip";

    res.setHeader('Content-Disposition', utils.getContentDisposition(zipFileName));
    res.setHeader('Content-Type', 'application/zip');

    archive.pipe(res);
    archive.finalize();

    taskContext.taskSucceeded();
}

module.exports = {
    exportToZip
};
