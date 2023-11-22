"use strict";

const html = require('html');
const dateUtils = require('../date_utils.js');
const path = require('path');
const mimeTypes = require('mime-types');
const mdService = require('./md.js');
const packageInfo = require('../../../package.json');
const utils = require('../utils.js');
const protectedSessionService = require('../protected_session.js');
const sanitize = require("sanitize-filename");
const fs = require("fs");
const becca = require('../../becca/becca.js');
const RESOURCE_DIR = require('../../services/resource_dir.js').RESOURCE_DIR;
const archiver = require('archiver');
const log = require('../log.js');
const TaskContext = require('../task_context.js');
const ValidationError = require('../../errors/validation_error.js');
const NoteMeta = require('../meta/note_meta.js');
const AttachmentMeta = require('../meta/attachment_meta.js');
const AttributeMeta = require('../meta/attribute_meta.js');

/**
 * @param {TaskContext} taskContext
 * @param {BBranch} branch
 * @param {string} format - 'html' or 'markdown'
 * @param {object} res - express response
 * @param {boolean} setHeaders
 */
async function exportToZip(taskContext, branch, format, res, setHeaders = true) {
    if (!['html', 'markdown'].includes(format)) {
        throw new ValidationError(`Only 'html' and 'markdown' allowed as export format, '${format}' given`);
    }

    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    /** @type {Object.<string, NoteMeta>} */
    const noteIdToMeta = {};

    /**
     * @param {Object.<string, int>} existingFileNames
     * @param {string} fileName
     * @returns {string}
     */
    function getUniqueFilename(existingFileNames, fileName) {
        const lcFileName = fileName.toLowerCase();

        if (lcFileName in existingFileNames) {
            let index;
            let newName;

            do {
                index = existingFileNames[lcFileName]++;

                newName = `${index}_${lcFileName}`;
            }
            while (newName in existingFileNames);

            return `${index}_${fileName}`;
        }
        else {
            existingFileNames[lcFileName] = 1;

            return fileName;
        }
    }

    /**
     * @param {string|null} type
     * @param {string} mime
     * @param {string} baseFileName
     * @param {Object.<string, int>} existingFileNames
     * @return {string}
     */
    function getDataFileName(type, mime, baseFileName, existingFileNames) {
        let fileName = baseFileName.trim();
        if (fileName.length > 30) {
            fileName = fileName.substr(0, 30).trim();
        }

        let existingExtension = path.extname(fileName).toLowerCase();
        let newExtension;

        // the following two are handled specifically since we always want to have these extensions no matter the automatic detection
        // and/or existing detected extensions in the note name
        if (type === 'text' && format === 'markdown') {
            newExtension = 'md';
        }
        else if (type === 'text' && format === 'html') {
            newExtension = 'html';
        }
        else if (mime === 'application/x-javascript' || mime === 'text/javascript') {
            newExtension = 'js';
        }
        else if (existingExtension.length > 0) { // if the page already has an extension, then we'll just keep it
            newExtension = null;
        }
        else {
            if (mime?.toLowerCase()?.trim() === "image/jpg") {
                newExtension = 'jpg';
            } else if (mime?.toLowerCase()?.trim() === "text/mermaid") {
                newExtension = 'txt';
            } else {
                newExtension = mimeTypes.extension(mime) || "dat";
            }
        }

        // if the note is already named with the extension (e.g. "image.jpg"), then it's silly to append the exact same extension again
        if (newExtension && existingExtension !== `.${newExtension.toLowerCase()}`) {
            fileName += `.${newExtension}`;
        }

        return getUniqueFilename(existingFileNames, fileName);
    }

    /**
     * @param {BBranch} branch
     * @param {NoteMeta} parentMeta
     * @param {Object.<string, int>} existingFileNames
     * @returns {NoteMeta|null}
     */
    function createNoteMeta(branch, parentMeta, existingFileNames) {
        const note = branch.getNote();

        if (note.hasOwnedLabel('excludeFromExport')) {
            return null;
        }

        const title = note.getTitleOrProtected();
        const completeTitle = branch.prefix ? (`${branch.prefix} - ${title}`) : title;
        let baseFileName = sanitize(completeTitle);

        if (baseFileName.length > 200) { // the actual limit is 256 bytes(!) but let's be conservative
            baseFileName = baseFileName.substr(0, 200);
        }

        const notePath = parentMeta.notePath.concat([note.noteId]);

        if (note.noteId in noteIdToMeta) {
            const fileName = getUniqueFilename(existingFileNames, `${baseFileName}.clone.${format === 'html' ? 'html' : 'md'}`);

            const meta = new NoteMeta();
            meta.isClone = true;
            meta.noteId = note.noteId;
            meta.notePath = notePath;
            meta.title = note.getTitleOrProtected();
            meta.prefix = branch.prefix;
            meta.dataFileName = fileName;
            meta.type = 'text'; // export will have text description
            meta.format = format;
            return meta;
        }

        const meta = new NoteMeta();
        meta.isClone = false;
        meta.noteId = note.noteId;
        meta.notePath = notePath;
        meta.title = note.getTitleOrProtected();
        meta.notePosition = branch.notePosition;
        meta.prefix = branch.prefix;
        meta.isExpanded = branch.isExpanded;
        meta.type = note.type;
        meta.mime = note.mime;
        meta.attributes = note.getOwnedAttributes().map(attribute => {
            const attrMeta = new AttributeMeta();
            attrMeta.type = attribute.type;
            attrMeta.name = attribute.name;
            attrMeta.value = attribute.value;
            attrMeta.isInheritable = attribute.isInheritable;
            attrMeta.position = attribute.position;
            return attrMeta;
        });

        taskContext.increaseProgressCount();

        if (note.type === 'text') {
            meta.format = format;
        }

        noteIdToMeta[note.noteId] = meta;

        const childBranches = note.getChildBranches()
            .filter(branch => branch.noteId !== '_hidden');

        const available = !note.isProtected || protectedSessionService.isProtectedSessionAvailable();

        // if it's a leaf, then we'll export it even if it's empty
        if (available && (note.getContent().length > 0 || childBranches.length === 0)) {
            meta.dataFileName = getDataFileName(note.type, note.mime, baseFileName, existingFileNames);
        }

        const attachments = note.getAttachments();
        meta.attachments = attachments
            .map(attachment => {
                const attMeta = new AttachmentMeta();
                attMeta.attachmentId = attachment.attachmentId;
                attMeta.title = attachment.title;
                attMeta.role = attachment.role;
                attMeta.mime = attachment.mime;
                attMeta.position = attachment.position;
                attMeta.dataFileName = getDataFileName(
                    null,
                    attachment.mime,
                    baseFileName + "_" + attachment.title,
                    existingFileNames
                );
                return attMeta;
            });

        if (childBranches.length > 0) {
            meta.dirFileName = getUniqueFilename(existingFileNames, baseFileName);
            meta.children = [];

            // namespace is shared by children in the same note
            const childExistingNames = {};

            for (const childBranch of childBranches) {
                const note = createNoteMeta(childBranch, meta, childExistingNames);

                // can be undefined if export is disabled for this note
                if (note) {
                    meta.children.push(note);
                }
            }
        }

        return meta;
    }

    /**
     * @param {string} targetNoteId
     * @param {NoteMeta} sourceMeta
     * @return {string|null}
     */
    function getNoteTargetUrl(targetNoteId, sourceMeta) {
        const targetMeta = noteIdToMeta[targetNoteId];

        if (!targetMeta) {
            return null;
        }

        const targetPath = targetMeta.notePath.slice();
        const sourcePath = sourceMeta.notePath.slice();

        // > 1 for the edge case that targetPath and sourcePath are exact same (a link to itself)
        while (targetPath.length > 1 && sourcePath.length > 1 && targetPath[0] === sourcePath[0]) {
            targetPath.shift();
            sourcePath.shift();
        }

        let url = "../".repeat(sourcePath.length - 1);

        for (let i = 0; i < targetPath.length - 1; i++) {
            const meta = noteIdToMeta[targetPath[i]];

            url += `${encodeURIComponent(meta.dirFileName)}/`;
        }

        const meta = noteIdToMeta[targetPath[targetPath.length - 1]];

        // link can target note which is only "folder-note" and as such, will not have a file in an export
        url += encodeURIComponent(meta.dataFileName || meta.dirFileName);

        return url;
    }

    /**
     * @param {string} content
     * @param {NoteMeta} noteMeta
     * @return {string}
     */
    function rewriteLinks(content, noteMeta) {
        content = content.replace(/src="[^"]*api\/images\/([a-zA-Z0-9_]+)\/[^"]*"/g, (match, targetNoteId) => {
            const url = getNoteTargetUrl(targetNoteId, noteMeta);

            return url ? `src="${url}"` : match;
        });

        content = content.replace(/src="[^"]*api\/attachments\/([a-zA-Z0-9_]+)\/image\/[^"]*"/g, (match, targetAttachmentId) => {
            const url = findAttachment(targetAttachmentId);

            return url ? `src="${url}"` : match;
        });

        content = content.replace(/href="[^"]*#root[^"]*attachmentId=([a-zA-Z0-9_]+)\/?"/g, (match, targetAttachmentId) => {
            const url = findAttachment(targetAttachmentId);

            return url ? `href="${url}"` : match;
        });

        content = content.replace(/href="[^"]*#root[a-zA-Z0-9_\/]*\/([a-zA-Z0-9_]+)[^"]*"/g, (match, targetNoteId) => {
            const url = getNoteTargetUrl(targetNoteId, noteMeta);

            return url ? `href="${url}"` : match;
        });

        return content;

        function findAttachment(targetAttachmentId) {
            let url;

            const attachmentMeta = noteMeta.attachments.find(attMeta => attMeta.attachmentId === targetAttachmentId);
            if (attachmentMeta) {
                // easy job here, because attachment will be in the same directory as the note's data file.
                url = attachmentMeta.dataFileName;
            } else {
                log.info(`Could not find attachment meta object for attachmentId '${targetAttachmentId}'`);
            }
            return url;
        }
    }

    /**
     * @param {string} title
     * @param {string|Buffer} content
     * @param {NoteMeta} noteMeta
     * @return {string|Buffer}
     */
    function prepareContent(title, content, noteMeta) {
        if (['html', 'markdown'].includes(noteMeta.format)) {
            content = content.toString();

            content = rewriteLinks(content, noteMeta);
        }

        if (noteMeta.format === 'html') {
            if (!content.substr(0, 100).toLowerCase().includes("<html")) {
                const cssUrl = `${"../".repeat(noteMeta.notePath.length - 1)}style.css`;
                const htmlTitle = utils.escapeHtml(title);

                // <base> element will make sure external links are openable - https://github.com/zadam/trilium/issues/1289#issuecomment-704066809
                content = `<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="${cssUrl}">
    <base target="_parent">
    <title data-trilium-title>${htmlTitle}</title>
</head>
<body>
  <div class="content">
      <h1 data-trilium-h1>${htmlTitle}</h1>
      
      <div class="ck-content">${content}</div>
  </div>
</body>
</html>`;
            }

            return content.length < 100_000
                ? html.prettyPrint(content, {indent_size: 2})
                : content;
        } else if (noteMeta.format === 'markdown') {
            let markdownContent = mdService.toMarkdown(content);

            if (markdownContent.trim().length > 0 && !markdownContent.startsWith("# ")) {
                markdownContent = `# ${title}\r
${markdownContent}`;
            }

            return markdownContent;
        } else {
            return content;
        }
    }

    /**
     * @param {NoteMeta} noteMeta
     * @param {string} filePathPrefix
     */
    function saveNote(noteMeta, filePathPrefix) {
        log.info(`Exporting note '${noteMeta.noteId}'`);

        if (noteMeta.isClone) {
            const targetUrl = getNoteTargetUrl(noteMeta.noteId, noteMeta);

            let content = `<p>This is a clone of a note. Go to its <a href="${targetUrl}">primary location</a>.</p>`;

            content = prepareContent(noteMeta.title, content, noteMeta);

            archive.append(content, { name: filePathPrefix + noteMeta.dataFileName });

            return;
        }

        const note = becca.getNote(noteMeta.noteId);

        if (noteMeta.dataFileName) {
            const content = prepareContent(noteMeta.title, note.getContent(), noteMeta);

            archive.append(content, {
                name: filePathPrefix + noteMeta.dataFileName,
                date: dateUtils.parseDateTime(note.utcDateModified)
            });
        }

        taskContext.increaseProgressCount();

        for (const attachmentMeta of noteMeta.attachments) {
            const attachment = note.getAttachmentById(attachmentMeta.attachmentId);
            const content = attachment.getContent();

            archive.append(content, {
                name: filePathPrefix + attachmentMeta.dataFileName,
                date: dateUtils.parseDateTime(note.utcDateModified)
            });
        }

        if (noteMeta.children?.length > 0) {
            const directoryPath = filePathPrefix + noteMeta.dirFileName;

            // create directory
            archive.append('', { name: `${directoryPath}/`, date: dateUtils.parseDateTime(note.utcDateModified) });

            for (const childMeta of noteMeta.children) {
                saveNote(childMeta, `${directoryPath}/`);
            }
        }
    }

    /**
     * @param {NoteMeta} rootMeta
     * @param {NoteMeta} navigationMeta
     */
    function saveNavigation(rootMeta, navigationMeta) {
        function saveNavigationInner(meta) {
            let html = '<li>';

            const escapedTitle = utils.escapeHtml(`${meta.prefix ? `${meta.prefix} - ` : ''}${meta.title}`);

            if (meta.dataFileName) {
                const targetUrl = getNoteTargetUrl(meta.noteId, rootMeta);

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

            return `${html}</li>`;
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
        const prettyHtml = fullHtml.length < 100_000
            ? html.prettyPrint(fullHtml, {indent_size: 2})
            : fullHtml;

        archive.append(prettyHtml, { name: navigationMeta.dataFileName });
    }

    /**
     * @param {NoteMeta} rootMeta
     * @param {NoteMeta} indexMeta
     */
    function saveIndex(rootMeta, indexMeta) {
        let firstNonEmptyNote;
        let curMeta = rootMeta;

        while (!firstNonEmptyNote) {
            if (curMeta.dataFileName) {
                firstNonEmptyNote = getNoteTargetUrl(curMeta.noteId, rootMeta);
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

    /**
     * @param {NoteMeta} rootMeta
     * @param {NoteMeta} cssMeta
     */
    function saveCss(rootMeta, cssMeta) {
        const cssContent = fs.readFileSync(`${RESOURCE_DIR}/libraries/ckeditor/ckeditor-content.css`);

        archive.append(cssContent, { name: cssMeta.dataFileName });
    }

    const existingFileNames = format === 'html' ? ['navigation', 'index'] : [];
    const rootMeta = createNoteMeta(branch, { notePath: [] }, existingFileNames);

    const metaFile = {
        formatVersion: 2,
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
        noteMeta.attributes = noteMeta.attributes.filter(attr => {
            if (attr.type !== 'relation') {
                return true;
            } else if (attr.value in noteIdToMeta) {
                return true;
            } else if (attr.value === 'root' || attr.value?.startsWith("_")) {
                // relations to "named" noteIds can be preserved
                return true;
            } else {
                return false;
            }
        });
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
    const zipFileName = `${branch.prefix ? `${branch.prefix} - ` : ""}${note.getTitleOrProtected()}.zip`;

    if (setHeaders) {
        res.setHeader('Content-Disposition', utils.getContentDisposition(zipFileName));
        res.setHeader('Content-Type', 'application/zip');
    }

    archive.pipe(res);
    await archive.finalize();

    taskContext.taskSucceeded();
}

async function exportToZipFile(noteId, format, zipFilePath) {
    const fileOutputStream = fs.createWriteStream(zipFilePath);
    const taskContext = new TaskContext('no-progress-reporting');

    const note = becca.getNote(noteId);

    if (!note) {
        throw new ValidationError(`Note ${noteId} not found.`);
    }

    await exportToZip(taskContext, note.getParentBranches()[0], format, fileOutputStream, false);

    log.info(`Exported '${noteId}' with format '${format}' to '${zipFilePath}'`);
}

module.exports = {
    exportToZip,
    exportToZipFile
};
