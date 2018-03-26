const sql = require('./sql');
const options = require('./options');
const utils = require('./utils');
const sync_table = require('./sync_table');
const labels = require('./labels');
const protected_session = require('./protected_session');

async function createNewNote(parentNoteId, noteOpts, dataKey, sourceId) {
    const noteId = utils.newNoteId();
    const branchId = utils.newBranchId();

    let newNotePos = 0;

    if (noteOpts.target === 'into') {
        const maxNotePos = await sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);

        newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;
    }
    else if (noteOpts.target === 'after') {
        const afterNote = await sql.getRow('SELECT notePosition FROM branches WHERE branchId = ?', [noteOpts.target_branchId]);

        newNotePos = afterNote.notePosition + 1;

        // not updating dateModified to avoig having to sync whole rows
        await sql.execute('UPDATE branches SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [parentNoteId, afterNote.notePosition]);

        await sync_table.addNoteReorderingSync(parentNoteId, sourceId);
    }
    else {
        throw new Error('Unknown target: ' + noteOpts.target);
    }

    if (parentNoteId !== 'root') {
        const parent = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

        if (!noteOpts.type) {
            noteOpts.type = parent.type;
        }

        if (!noteOpts.mime) {
            noteOpts.mime = parent.mime;
        }
    }

    const now = utils.nowDate();

    const note = {
        noteId: noteId,
        title: noteOpts.title,
        content: noteOpts.content ? noteOpts.content : '',
        isProtected: noteOpts.isProtected,
        type: noteOpts.type ? noteOpts.type : 'text',
        mime: noteOpts.mime ? noteOpts.mime : 'text/html',
        dateCreated: now,
        dateModified: now
    };

    if (note.isProtected) {
        protected_session.encryptNote(dataKey, note);
    }

    await sql.insert("notes", note);

    await sync_table.addNoteSync(noteId, sourceId);

    await sql.insert("branches", {
        branchId: branchId,
        noteId: noteId,
        parentNoteId: parentNoteId,
        notePosition: newNotePos,
        isExpanded: 0,
        dateModified: now,
        isDeleted: 0
    });

    await sync_table.addBranchSync(branchId, sourceId);

    return {
        noteId,
        branchId,
        note
    };
}

async function createNote(parentNoteId, title, content = "", extraOptions = {}) {
    if (!parentNoteId) throw new Error("Empty parentNoteId");
    if (!title) throw new Error("Empty title");

    const note = {
        title: title,
        content: extraOptions.json ? JSON.stringify(content, null, '\t') : content,
        target: 'into',
        isProtected: extraOptions.isProtected !== undefined ? extraOptions.isProtected : false,
        type: extraOptions.type,
        mime: extraOptions.mime
    };

    if (extraOptions.json && !note.type) {
        note.type = "code";
        note.mime = "application/json";
    }

    if (!note.type) {
        note.type = "text";
        note.mime = "text/html";
    }

    const {noteId} = await createNewNote(parentNoteId, note, extraOptions.dataKey, extraOptions.sourceId);

    if (extraOptions.labels) {
        for (const attrName in extraOptions.labels) {
            await labels.createLabel(noteId, attrName, extraOptions.labels[attrName]);
        }
    }

    return noteId;
}

async function protectNoteRecursively(noteId, dataKey, protect, sourceId) {
    const note = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    await protectNote(note, dataKey, protect, sourceId);

    const children = await sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [noteId]);

    for (const childNoteId of children) {
        await protectNoteRecursively(childNoteId, dataKey, protect, sourceId);
    }
}

async function protectNote(note, dataKey, protect, sourceId) {
    let changed = false;

    if (protect && !note.isProtected) {
        protected_session.encryptNote(dataKey, note);

        note.isProtected = true;

        changed = true;
    }
    else if (!protect && note.isProtected) {
        protected_session.decryptNote(dataKey, note);

        note.isProtected = false;

        changed = true;
    }

    if (changed) {
        await sql.execute("UPDATE notes SET title = ?, content = ?, isProtected = ? WHERE noteId = ?",
            [note.title, note.content, note.isProtected, note.noteId]);

        await sync_table.addNoteSync(note.noteId, sourceId);
    }

    await protectNoteRevisions(note.noteId, dataKey, protect, sourceId);
}

async function protectNoteRevisions(noteId, dataKey, protect, sourceId) {
    const revisionsToChange = await sql.getRows("SELECT * FROM note_revisions WHERE noteId = ? AND isProtected != ?", [noteId, protect]);

    for (const revision of revisionsToChange) {
        if (protect) {
            protected_session.encryptNoteRevision(dataKey, revision);

            revision.isProtected = true;
        }
        else {
            protected_session.decryptNoteRevision(dataKey, revision);

            revision.isProtected = false;
        }

        await sql.execute("UPDATE note_revisions SET title = ?, content = ?, isProtected = ? WHERE noteRevisionId = ?",
            [revision.title, revision.content, revision.isProtected, revision.noteRevisionId]);

        await sync_table.addNoteRevisionSync(revision.noteRevisionId, sourceId);
    }
}

async function saveNoteRevision(noteId, dataKey, sourceId, nowStr) {
    const oldNote = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (oldNote.type === 'file') {
        return;
    }

    if (oldNote.isProtected) {
        protected_session.decryptNote(dataKey, oldNote);

        oldNote.isProtected = false;
    }

    const newNoteRevisionId = utils.newNoteRevisionId();

    await sql.insert('note_revisions', {
        noteRevisionId: newNoteRevisionId,
        noteId: noteId,
        // title and text should be decrypted now
        title: oldNote.title,
        content: oldNote.content,
        isProtected: 0, // will be fixed in the protectNoteRevisions() call
        dateModifiedFrom: oldNote.dateModified,
        dateModifiedTo: nowStr
    });

    await sync_table.addNoteRevisionSync(newNoteRevisionId, sourceId);
}

async function saveNoteImages(noteId, noteText, sourceId) {
    const existingNoteImages = await sql.getRows("SELECT * FROM note_images WHERE noteId = ?", [noteId]);
    const foundImageIds = [];
    const now = utils.nowDate();
    const re = /src="\/api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(noteText)) {
        const imageId = match[1];
        const existingNoteImage = existingNoteImages.find(ni => ni.imageId === imageId);

        if (!existingNoteImage) {
            const noteImageId = utils.newNoteImageId();

            await sql.insert("note_images", {
                noteImageId: noteImageId,
                noteId: noteId,
                imageId: imageId,
                isDeleted: 0,
                dateModified: now,
                dateCreated: now
            });

            await sync_table.addNoteImageSync(noteImageId, sourceId);
        }
        else if (existingNoteImage.isDeleted) {
            await sql.execute("UPDATE note_images SET isDeleted = 0, dateModified = ? WHERE noteImageId = ?",
                [now, existingNoteImage.noteImageId]);

            await sync_table.addNoteImageSync(existingNoteImage.noteImageId, sourceId);
        }
        // else we don't need to do anything

        foundImageIds.push(imageId);
    }

    // marking note images as deleted if they are not present on the page anymore
    const unusedNoteImages = existingNoteImages.filter(ni => !foundImageIds.includes(ni.imageId));

    for (const unusedNoteImage of unusedNoteImages) {
        await sql.execute("UPDATE note_images SET isDeleted = 1, dateModified = ? WHERE noteImageId = ?",
            [now, unusedNoteImage.noteImageId]);

        await sync_table.addNoteImageSync(unusedNoteImage.noteImageId, sourceId);
    }
}

async function loadFile(noteId, newNote, dataKey) {
    const oldNote = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (oldNote.isProtected) {
        await protected_session.decryptNote(dataKey, oldNote);
    }

    newNote.detail.content = oldNote.content;
}

async function updateNote(noteId, newNote, dataKey, sourceId) {
    if (newNote.detail.type === 'file') {
        await loadFile(noteId, newNote, dataKey);
    }

    if (newNote.detail.isProtected) {
        await protected_session.encryptNote(dataKey, newNote.detail);
    }

    const labelsMap = await labels.getNoteLabelMap(noteId);

    const now = new Date();
    const nowStr = utils.nowDate();

    const noteRevisionSnapshotTimeInterval = parseInt(await options.getOption('note_revision_snapshot_time_interval'));

    const revisionCutoff = utils.dateStr(new Date(now.getTime() - noteRevisionSnapshotTimeInterval * 1000));

    const existingnoteRevisionId = await sql.getValue(
        "SELECT noteRevisionId FROM note_revisions WHERE noteId = ? AND dateModifiedTo >= ?", [noteId, revisionCutoff]);

    await sql.doInTransaction(async () => {
        const msSinceDateCreated = now.getTime() - utils.parseDateTime(newNote.detail.dateCreated).getTime();

        if (labelsMap.disable_versioning !== 'true'
            && !existingnoteRevisionId
            && msSinceDateCreated >= noteRevisionSnapshotTimeInterval * 1000) {

            await saveNoteRevision(noteId, dataKey, sourceId, nowStr);
        }

        await saveNoteImages(noteId, newNote.detail.content, sourceId);

        await protectNoteRevisions(noteId, dataKey, newNote.detail.isProtected);

        await sql.execute("UPDATE notes SET title = ?, content = ?, isProtected = ?, dateModified = ? WHERE noteId = ?", [
            newNote.detail.title,
            newNote.detail.content,
            newNote.detail.isProtected,
            nowStr,
            noteId]);

        await sync_table.addNoteSync(noteId, sourceId);
    });
}

async function deleteNote(branchId, sourceId) {
    const branch = await sql.getRowOrNull("SELECT * FROM branches WHERE branchId = ?", [branchId]);

    if (!branch || branch.isDeleted === 1) {
        return;
    }

    const now = utils.nowDate();

    await sql.execute("UPDATE branches SET isDeleted = 1, dateModified = ? WHERE branchId = ?", [now, branchId]);
    await sync_table.addBranchSync(branchId, sourceId);

    const noteId = await sql.getValue("SELECT noteId FROM branches WHERE branchId = ?", [branchId]);

    const notDeletedBranchsCount = await sql.getValue("SELECT COUNT(*) FROM branches WHERE noteId = ? AND isDeleted = 0", [noteId]);

    if (!notDeletedBranchsCount) {
        await sql.execute("UPDATE notes SET isDeleted = 1, dateModified = ? WHERE noteId = ?", [now, noteId]);
        await sync_table.addNoteSync(noteId, sourceId);

        const children = await sql.getRows("SELECT branchId FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [noteId]);

        for (const child of children) {
            await deleteNote(child.branchId, sourceId);
        }
    }
}

module.exports = {
    createNewNote,
    createNote,
    updateNote,
    deleteNote,
    protectNoteRecursively
};