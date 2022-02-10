#!/usr/bin/env node

const fs = require('fs');
const sql = require("./inc/sql");

const args = process.argv.slice(2);
const sanitize = require('sanitize-filename');
const path = require("path");
const mimeTypes = require("mime-types");

if (args[0] === '-h' || args[0] === '--help') {
    printHelp();
    process.exit(0);
}

if (args.length !== 2) {
    console.error(`Exactly 2 arguments are expected. Run with --help to see usage.`);
    process.exit(1);
}

const [documentPath, targetPath] = args;

if (!fs.existsSync(documentPath)) {
    console.error(`Path to document '${documentPath}' has not been found. Run with --help to see usage.`);
    process.exit(1);
}

if (!fs.existsSync(targetPath)) {
    const ret = fs.mkdirSync(targetPath, { recursive: true });

    if (!ret) {
        console.error(`Target path '${targetPath}' could not be created. Run with --help to see usage.`);
        process.exit(1);
    }
}

sql.openDatabase(documentPath);

const existingPaths = {};

dumpNote(targetPath, 'root');

function getFileName(note, childTargetPath, safeTitle) {
    let existingExtension = path.extname(safeTitle).toLowerCase();
    let newExtension;

    if (note.type === 'text') {
        newExtension = 'html';
    } else if (note.mime === 'application/x-javascript' || note.mime === 'text/javascript') {
        newExtension = 'js';
    } else if (existingExtension.length > 0) { // if the page already has an extension, then we'll just keep it
        newExtension = null;
    } else {
        if (note.mime?.toLowerCase()?.trim() === "image/jpg") { // image/jpg is invalid but pretty common
            newExtension = 'jpg';
        } else {
            newExtension = mimeTypes.extension(note.mime) || "dat";
        }
    }

    let fileNameWithPath = childTargetPath;

    // if the note is already named with extension (e.g. "jquery"), then it's silly to append exact same extension again
    if (newExtension && existingExtension !== "." + newExtension.toLowerCase()) {
        fileNameWithPath += "." + newExtension;
    }
    return fileNameWithPath;
}

function dumpNote(targetPath, noteId) {
    console.log(`Dumping note ${noteId}`);

    const note = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    let safeTitle = sanitize(note.title);

    if (safeTitle.length > 20) {
        safeTitle = safeTitle.substring(0, 20);
    }

    let childTargetPath = targetPath + '/' + safeTitle;

    for (let i = 1; i < 100000 && childTargetPath in existingPaths; i++) {
        childTargetPath = targetPath + '/' + safeTitle + '_' + i;
    }

    existingPaths[childTargetPath] = true;

    try {
        const {content} = sql.getRow("SELECT content FROM note_contents WHERE noteId = ?", [noteId]);

        if (!isContentEmpty(content)) {
            const fileNameWithPath = getFileName(note, childTargetPath, safeTitle);

            fs.writeFileSync(fileNameWithPath, content);
        }
    }
    catch (e) {
        console.log(`Writing ${note.noteId} failed with error ${e.message}`);
    }

    const childNoteIds = sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ?", [noteId]);

    if (childNoteIds.length > 0) {
        fs.mkdirSync(childTargetPath, { recursive: true });

        for (const childNoteId of childNoteIds) {
            dumpNote(childTargetPath, childNoteId);
        }
    }
}

function isContentEmpty(content) {
    if (!content) {
        return true;
    }

    if (typeof content === "string") {
        return !content.trim() || content.trim() === '<p></p>';
    }
    else if (Buffer.isBuffer(content)) {
        return content.length === 0;
    }
    else {
        return false;
    }
}

function printHelp() {
    console.log(`Trilium Notes DB dump tool. Usage:
node dump-db.js PATH_TO_DOCUMENT_DB TARGET_PATH`);
}
