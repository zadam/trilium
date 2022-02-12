const fs = require("fs");
const sanitize = require("sanitize-filename");
const sql = require("./sql.js");
const decryptService = require("./decrypt.js");
const dataKeyService = require("./data_key.js");
const extensionService = require("./extension.js");

function dumpDocument(documentPath, targetPath, options) {
    const stats = {
        succeeded: 0,
        failed: 0,
        protected: 0,
        deleted: 0
    };

    validatePaths(documentPath, targetPath);

    sql.openDatabase(documentPath);

    const dataKey = dataKeyService.getDataKey(options.password);

    const existingPaths = {};
    const noteIdToPath = {};

    dumpNote(targetPath, 'root');

    printDumpResults(stats, options);

    function dumpNote(targetPath, noteId) {
        console.log(`Reading note '${noteId}'`);

        let childTargetPath, note, fileNameWithPath;

        try {
            note = sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

            if (note.isDeleted) {
                stats.deleted++;

                if (!options.includeDeleted) {
                    console.log(`Note '${noteId}' is deleted and --include-deleted option is not used, skipping.`);

                    return;
                }
            }

            if (note.isProtected) {
                stats.protected++;

                note.title = decryptService.decryptString(dataKey, note.title);
            }

            let safeTitle = sanitize(note.title);

            if (safeTitle.length > 20) {
                safeTitle = safeTitle.substring(0, 20);
            }

            childTargetPath = targetPath + '/' + safeTitle;

            for (let i = 1; i < 100000 && childTargetPath in existingPaths; i++) {
                childTargetPath = targetPath + '/' + safeTitle + '_' + i;
            }

            existingPaths[childTargetPath] = true;

            if (note.noteId in noteIdToPath) {
                const message = `Note '${noteId}' has been already dumped to ${noteIdToPath[note.noteId]}`;

                console.log(message);

                fs.writeFileSync(childTargetPath, message);

                return;
            }

            let {content} = sql.getRow("SELECT content FROM note_contents WHERE noteId = ?", [noteId]);

            if (content !== null && note.isProtected && dataKey) {
                content = decryptService.decrypt(dataKey, content);
            }

            if (isContentEmpty(content)) {
                console.log(`Note '${noteId}' is empty, skipping.`);
            } else {
                fileNameWithPath = extensionService.getFileName(note, childTargetPath, safeTitle);

                fs.writeFileSync(fileNameWithPath, content);

                stats.succeeded++;

                console.log(`Dumped note '${noteId}' into ${fileNameWithPath} successfully.`);
            }

            noteIdToPath[noteId] = childTargetPath;
        }
        catch (e) {
            console.error(`DUMPERROR: Writing '${noteId}' failed with error '${e.message}':\n${e.stack}`);

            stats.failed++;
        }

        const childNoteIds = sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ?", [noteId]);

        if (childNoteIds.length > 0) {
            if (childTargetPath === fileNameWithPath) {
                childTargetPath += '_dir';
            }

            try {
                fs.mkdirSync(childTargetPath, {recursive: true});
            }
            catch (e) {
                console.error(`DUMPERROR: Creating directory ${childTargetPath} failed with error '${e.message}'`);
            }

            for (const childNoteId of childNoteIds) {
                dumpNote(childTargetPath, childNoteId);
            }
        }
    }
}

function printDumpResults(stats, options) {
    console.log('\n----------------------- STATS -----------------------');
    console.log('Successfully dumpted notes:   ', stats.succeeded.toString().padStart(5, ' '));
    console.log('Protected notes:              ', stats.protected.toString().padStart(5, ' '), options.password ? '' : '(skipped)');
    console.log('Failed notes:                 ', stats.failed.toString().padStart(5, ' '));
    console.log('Deleted notes:                ', stats.deleted.toString().padStart(5, ' '), options.includeDeleted ? "(dumped)" : "(at least, skipped)");
    console.log('-----------------------------------------------------');

    if (!options.password && stats.protected > 0) {
        console.log("\nWARNING: protected notes are present in the document but no password has been provided. Protected notes have not been dumped.");
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

function validatePaths(documentPath, targetPath) {
    if (!fs.existsSync(documentPath)) {
        console.error(`Path to document '${documentPath}' has not been found. Run with --help to see usage.`);
        process.exit(1);
    }

    if (!fs.existsSync(targetPath)) {
        const ret = fs.mkdirSync(targetPath, {recursive: true});

        if (!ret) {
            console.error(`Target path '${targetPath}' could not be created. Run with --help to see usage.`);
            process.exit(1);
        }
    }
}

module.exports = {
    dumpDocument
};
