const sql = require('./sql');
const options = require('./options');
const utils = require('./utils');
const sync_table = require('./sync_table');
const attributes = require('./attributes');
const protected_session = require('./protected_session');

async function getNoteById(noteId, dataKey) {
    const note = await sql.getFirst("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    protected_session.decryptNote(dataKey, note);

    return note;
}

async function getJsonNoteById(noteId, dataKey) {
    const note = await getNoteById(noteId, dataKey);
    note.data = JSON.parse(note.content);

    return note;
}

async function updateJsonNote(noteId, data) {
    const ret = await createNewNote(noteId, {
        title: name,
        content: JSON.stringify(data),
        target: 'into',
        isProtected: false,
        type: 'code',
        mime: 'application/json'
    });

    return ret.noteId;
}

async function createNewJsonNote(parentNoteId, name, payload) {
    const ret = await createNewNote(parentNoteId, {
        title: name,
        content: JSON.stringify(payload),
        target: 'into',
        isProtected: false,
        type: 'code',
        mime: 'application/json'
    });

    return ret.noteId;
}

async function createNewNote(parentNoteId, noteOpts, dataKey, sourceId) {
    const noteId = utils.newNoteId();
    const noteTreeId = utils.newNoteTreeId();

    let newNotePos = 0;

    if (noteOpts.target === 'into') {
        const maxNotePos = await sql.getFirstValue('SELECT MAX(notePosition) FROM notes_tree WHERE parentNoteId = ? AND isDeleted = 0', [parentNoteId]);

        newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;
    }
    else if (noteOpts.target === 'after') {
        const afterNote = await sql.getFirst('SELECT notePosition FROM notes_tree WHERE noteTreeId = ?', [noteOpts.target_noteTreeId]);

        newNotePos = afterNote.notePosition + 1;

        // not updating dateModified to avoig having to sync whole rows
        await sql.execute('UPDATE notes_tree SET notePosition = notePosition + 1 WHERE parentNoteId = ? AND notePosition > ? AND isDeleted = 0',
            [parentNoteId, afterNote.notePosition]);

        await sync_table.addNoteReorderingSync(parentNoteId, sourceId);
    }
    else {
        throw new Error('Unknown target: ' + noteOpts.target);
    }

    if (parentNoteId !== 'root') {
        const parent = await sql.getFirst("SELECT * FROM notes WHERE noteId = ?", [parentNoteId]);

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

    await sql.insert("notes_tree", {
        noteTreeId: noteTreeId,
        noteId: noteId,
        parentNoteId: parentNoteId,
        notePosition: newNotePos,
        isExpanded: 0,
        dateModified: now,
        isDeleted: 0
    });

    await sync_table.addNoteTreeSync(noteTreeId, sourceId);

    return {
        noteId,
        noteTreeId,
        note
    };
}

async function protectNoteRecursively(noteId, dataKey, protect, sourceId) {
    const note = await sql.getFirst("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    await protectNote(note, dataKey, protect, sourceId);

    const children = await sql.getFirstColumn("SELECT noteId FROM notes_tree WHERE parentNoteId = ? AND isDeleted = 0", [noteId]);

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

    await protectNoteHistory(note.noteId, dataKey, protect, sourceId);
}

async function protectNoteHistory(noteId, dataKey, protect, sourceId) {
    const historyToChange = await sql.getAll("SELECT * FROM notes_history WHERE noteId = ? AND isProtected != ?", [noteId, protect]);

    for (const history of historyToChange) {
        if (protect) {
            protected_session.encryptNoteHistoryRow(dataKey, history);

            history.isProtected = true;
        }
        else {
            protected_session.decryptNoteHistoryRow(dataKey, history);

            history.isProtected = false;
        }

        await sql.execute("UPDATE notes_history SET title = ?, content = ?, isProtected = ? WHERE noteHistoryId = ?",
            [history.title, history.content, history.isProtected, history.noteHistoryId]);

        await sync_table.addNoteHistorySync(history.noteHistoryId, sourceId);
    }
}

async function saveNoteHistory(noteId, dataKey, sourceId, nowStr) {
    const oldNote = await sql.getFirst("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (oldNote.isProtected) {
        protected_session.decryptNote(dataKey, oldNote);

        note.isProtected = false;
    }

    const newNoteHistoryId = utils.newNoteHistoryId();

    await sql.insert('notes_history', {
        noteHistoryId: newNoteHistoryId,
        noteId: noteId,
        // title and text should be decrypted now
        title: oldNote.title,
        content: oldNote.content,
        isProtected: 0, // will be fixed in the protectNoteHistory() call
        dateModifiedFrom: oldNote.dateModified,
        dateModifiedTo: nowStr
    });

    await sync_table.addNoteHistorySync(newNoteHistoryId, sourceId);
}

async function saveNoteImages(noteId, noteText, sourceId) {
    const existingNoteImages = await sql.getAll("SELECT * FROM notes_image WHERE noteId = ?", [noteId]);
    const foundImageIds = [];
    const now = utils.nowDate();
    const re = /src="\/api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(noteText)) {
        const imageId = match[1];
        const existingNoteImage = existingNoteImages.find(ni => ni.imageId === imageId);

        if (!existingNoteImage) {
            const noteImageId = utils.newNoteImageId();

            await sql.insert("notes_image", {
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
            await sql.execute("UPDATE notes_image SET isDeleted = 0, dateModified = ? WHERE noteImageId = ?",
                [now, existingNoteImage.noteImageId]);

            await sync_table.addNoteImageSync(existingNoteImage.noteImageId, sourceId);
        }
        // else we don't need to do anything

        foundImageIds.push(imageId);
    }

    // marking note images as deleted if they are not present on the page anymore
    const unusedNoteImages = existingNoteImages.filter(ni => !foundImageIds.includes(ni.imageId));

    for (const unusedNoteImage of unusedNoteImages) {
        await sql.execute("UPDATE notes_image SET isDeleted = 1, dateModified = ? WHERE noteImageId = ?",
            [now, unusedNoteImage.noteImageId]);

        await sync_table.addNoteImageSync(unusedNoteImage.noteImageId, sourceId);
    }
}

async function updateNote(noteId, newNote, dataKey, sourceId) {
    if (newNote.detail.isProtected) {
        await protected_session.encryptNote(dataKey, newNote.detail);
    }

    const attributesMap = await attributes.getNoteAttributeMap(noteId);

    const now = new Date();
    const nowStr = utils.nowDate();

    const historySnapshotTimeInterval = parseInt(await options.getOption('history_snapshot_time_interval'));

    const historyCutoff = utils.dateStr(new Date(now.getTime() - historySnapshotTimeInterval * 1000));

    const existingNoteHistoryId = await sql.getFirstValue(
        "SELECT noteHistoryId FROM notes_history WHERE noteId = ? AND dateModifiedTo >= ?", [noteId, historyCutoff]);

    await sql.doInTransaction(async () => {
        const msSinceDateCreated = now.getTime() - utils.parseDate(newNote.detail.dateCreated).getTime();

        if (attributesMap.disable_versioning !== 'true'
            && !existingNoteHistoryId
            && msSinceDateCreated >= historySnapshotTimeInterval * 1000) {

            await saveNoteHistory(noteId, dataKey, sourceId, nowStr);
        }

        await saveNoteImages(noteId, newNote.detail.content, sourceId);

        await protectNoteHistory(noteId, dataKey, newNote.detail.isProtected);

        await sql.execute("UPDATE notes SET title = ?, content = ?, isProtected = ?, dateModified = ? WHERE noteId = ?", [
            newNote.detail.title,
            newNote.detail.content,
            newNote.detail.isProtected,
            nowStr,
            noteId]);

        await sync_table.addNoteSync(noteId, sourceId);
    });
}

async function deleteNote(noteTreeId, sourceId) {
    const noteTree = await sql.getFirstOrNull("SELECT * FROM notes_tree WHERE noteTreeId = ?", [noteTreeId]);

    if (!noteTree || noteTree.isDeleted === 1) {
        return;
    }

    const now = utils.nowDate();

    await sql.execute("UPDATE notes_tree SET isDeleted = 1, dateModified = ? WHERE noteTreeId = ?", [now, noteTreeId]);
    await sync_table.addNoteTreeSync(noteTreeId, sourceId);

    const noteId = await sql.getFirstValue("SELECT noteId FROM notes_tree WHERE noteTreeId = ?", [noteTreeId]);

    const notDeletedNoteTreesCount = await sql.getFirstValue("SELECT COUNT(*) FROM notes_tree WHERE noteId = ? AND isDeleted = 0", [noteId]);

    if (!notDeletedNoteTreesCount) {
        await sql.execute("UPDATE notes SET isDeleted = 1, dateModified = ? WHERE noteId = ?", [now, noteId]);
        await sync_table.addNoteSync(noteId, sourceId);

        const children = await sql.getAll("SELECT noteTreeId FROM notes_tree WHERE parentNoteId = ? AND isDeleted = 0", [noteId]);

        for (const child of children) {
            await deleteNote(child.noteTreeId, sourceId);
        }
    }
}

module.exports = {
    getNoteById,
    createNewNote,
    updateNote,
    deleteNote,
    protectNoteRecursively
};