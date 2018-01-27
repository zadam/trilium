const sql = require('./sql');
const options = require('./options');
const utils = require('./utils');
const sync_table = require('./sync_table');
const attributes = require('./attributes');
const protected_session = require('./protected_session');

async function getNoteById(noteId, dataKey) {
    const note = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    protected_session.decryptNote(dataKey, note);

    return note;
}

async function getJsonNoteById(noteId, dataKey) {
    const note = await getNoteById(noteId, dataKey);
    note.data = JSON.parse(note.note_text);

    return note;
}

async function updateJsonNote(noteId, data) {
    const ret = await createNewNote(noteId, {
        note_title: name,
        note_text: JSON.stringify(data),
        target: 'into',
        is_protected: false,
        type: 'code',
        mime: 'application/json'
    });

    return ret.noteId;
}

async function createNewJsonNote(parentNoteId, name, payload) {
    const ret = await createNewNote(parentNoteId, {
        note_title: name,
        note_text: JSON.stringify(payload),
        target: 'into',
        is_protected: false,
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
        const maxNotePos = await sql.getFirstValue('SELECT MAX(note_position) FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0', [parentNoteId]);

        newNotePos = maxNotePos === null ? 0 : maxNotePos + 1;
    }
    else if (noteOpts.target === 'after') {
        const afterNote = await sql.getFirst('SELECT note_position FROM notes_tree WHERE note_tree_id = ?', [noteOpts.target_note_tree_id]);

        newNotePos = afterNote.note_position + 1;

        // not updating date_modified to avoig having to sync whole rows
        await sql.execute('UPDATE notes_tree SET note_position = note_position + 1 WHERE parent_note_id = ? AND note_position > ? AND is_deleted = 0',
            [parentNoteId, afterNote.note_position]);

        await sync_table.addNoteReorderingSync(parentNoteId, sourceId);
    }
    else {
        throw new Error('Unknown target: ' + noteOpts.target);
    }

    if (parentNoteId !== 'root') {
        const parent = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [parentNoteId]);

        if (!noteOpts.type) {
            noteOpts.type = parent.type;
        }

        if (!noteOpts.mime) {
            noteOpts.mime = parent.mime;
        }
    }

    const now = utils.nowDate();

    const note = {
        note_id: noteId,
        note_title: noteOpts.note_title,
        note_text: noteOpts.note_text ? noteOpts.note_text : '',
        is_protected: noteOpts.is_protected,
        type: noteOpts.type ? noteOpts.type : 'text',
        mime: noteOpts.mime ? noteOpts.mime : 'text/html',
        date_created: now,
        date_modified: now
    };

    if (note.is_protected) {
        protected_session.encryptNote(dataKey, note);
    }

    await sql.insert("notes", note);

    await sync_table.addNoteSync(noteId, sourceId);

    await sql.insert("notes_tree", {
        note_tree_id: noteTreeId,
        note_id: noteId,
        parent_note_id: parentNoteId,
        note_position: newNotePos,
        is_expanded: 0,
        date_modified: now,
        is_deleted: 0
    });

    await sync_table.addNoteTreeSync(noteTreeId, sourceId);

    return {
        noteId,
        noteTreeId
    };
}

async function protectNoteRecursively(noteId, dataKey, protect, sourceId) {
    const note = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    await protectNote(note, dataKey, protect, sourceId);

    const children = await sql.getFirstColumn("SELECT note_id FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0", [noteId]);

    for (const childNoteId of children) {
        await protectNoteRecursively(childNoteId, dataKey, protect, sourceId);
    }
}

async function protectNote(note, dataKey, protect, sourceId) {
    let changed = false;

    if (protect && !note.is_protected) {
        protected_session.encryptNote(dataKey, note);

        note.is_protected = true;

        changed = true;
    }
    else if (!protect && note.is_protected) {
        protected_session.decryptNote(dataKey, note);

        note.is_protected = false;

        changed = true;
    }

    if (changed) {
        await sql.execute("UPDATE notes SET note_title = ?, note_text = ?, is_protected = ? WHERE note_id = ?",
            [note.note_title, note.note_text, note.is_protected, note.note_id]);

        await sync_table.addNoteSync(note.note_id, sourceId);
    }

    await protectNoteHistory(note.note_id, dataKey, protect, sourceId);
}

async function protectNoteHistory(noteId, dataKey, protect, sourceId) {
    const historyToChange = await sql.getAll("SELECT * FROM notes_history WHERE note_id = ? AND is_protected != ?", [noteId, protect]);

    for (const history of historyToChange) {
        if (protect) {
            protected_session.encryptNoteHistoryRow(dataKey, history);

            history.is_protected = true;
        }
        else {
            protected_session.decryptNoteHistoryRow(dataKey, history);

            history.is_protected = false;
        }

        await sql.execute("UPDATE notes_history SET note_title = ?, note_text = ?, is_protected = ? WHERE note_history_id = ?",
            [history.note_title, history.note_text, history.is_protected, history.note_history_id]);

        await sync_table.addNoteHistorySync(history.note_history_id, sourceId);
    }
}

async function saveNoteHistory(noteId, dataKey, sourceId, nowStr) {
    const oldNote = await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    if (oldNote.is_protected) {
        protected_session.decryptNote(dataKey, oldNote);

        note.is_protected = false;
    }

    const newNoteHistoryId = utils.newNoteHistoryId();

    await sql.insert('notes_history', {
        note_history_id: newNoteHistoryId,
        note_id: noteId,
        // title and text should be decrypted now
        note_title: oldNote.note_title,
        note_text: oldNote.note_text,
        is_protected: 0, // will be fixed in the protectNoteHistory() call
        date_modified_from: oldNote.date_modified,
        date_modified_to: nowStr
    });

    await sync_table.addNoteHistorySync(newNoteHistoryId, sourceId);
}

async function saveNoteImages(noteId, noteText, sourceId) {
    const existingNoteImages = await sql.getAll("SELECT * FROM notes_image WHERE note_id = ?", [noteId]);
    const foundImageIds = [];
    const now = utils.nowDate();
    const re = /src="\/api\/images\/([a-zA-Z0-9]+)\//g;
    let match;

    while (match = re.exec(noteText)) {
        const imageId = match[1];
        const existingNoteImage = existingNoteImages.find(ni => ni.image_id === imageId);

        if (!existingNoteImage) {
            const noteImageId = utils.newNoteImageId();

            await sql.insert("notes_image", {
                note_image_id: noteImageId,
                note_id: noteId,
                image_id: imageId,
                is_deleted: 0,
                date_modified: now,
                date_created: now
            });

            await sync_table.addNoteImageSync(noteImageId, sourceId);
        }
        else if (existingNoteImage.is_deleted) {
            await sql.execute("UPDATE notes_image SET is_deleted = 0, date_modified = ? WHERE note_image_id = ?",
                [now, existingNoteImage.note_image_id]);

            await sync_table.addNoteImageSync(existingNoteImage.note_image_id, sourceId);
        }
        // else we don't need to do anything

        foundImageIds.push(imageId);
    }

    // marking note images as deleted if they are not present on the page anymore
    const unusedNoteImages = existingNoteImages.filter(ni => !foundImageIds.includes(ni.image_id));

    for (const unusedNoteImage of unusedNoteImages) {
        await sql.execute("UPDATE notes_image SET is_deleted = 1, date_modified = ? WHERE note_image_id = ?",
            [now, unusedNoteImage.note_image_id]);

        await sync_table.addNoteImageSync(unusedNoteImage.note_image_id, sourceId);
    }
}

async function updateNote(noteId, newNote, dataKey, sourceId) {
    if (newNote.detail.is_protected) {
        await protected_session.encryptNote(dataKey, newNote.detail);
    }

    const attributesMap = await attributes.getNoteAttributeMap(noteId);

    const now = new Date();
    const nowStr = utils.nowDate();

    const historySnapshotTimeInterval = parseInt(await options.getOption('history_snapshot_time_interval'));

    const historyCutoff = utils.dateStr(new Date(now.getTime() - historySnapshotTimeInterval * 1000));

    const existingNoteHistoryId = await sql.getFirstValue(
        "SELECT note_history_id FROM notes_history WHERE note_id = ? AND date_modified_to >= ?", [noteId, historyCutoff]);

    await sql.doInTransaction(async () => {
        const msSinceDateCreated = now.getTime() - utils.parseDate(newNote.detail.date_created).getTime();

        if (attributesMap.disable_versioning !== 'true'
            && !existingNoteHistoryId
            && msSinceDateCreated >= historySnapshotTimeInterval * 1000) {

            await saveNoteHistory(noteId, dataKey, sourceId, nowStr);
        }

        await saveNoteImages(noteId, newNote.detail.note_text, sourceId);

        await protectNoteHistory(noteId, dataKey, newNote.detail.is_protected);

        await sql.execute("UPDATE notes SET note_title = ?, note_text = ?, is_protected = ?, date_modified = ? WHERE note_id = ?", [
            newNote.detail.note_title,
            newNote.detail.note_text,
            newNote.detail.is_protected,
            nowStr,
            noteId]);

        await sync_table.addNoteSync(noteId, sourceId);
    });
}

async function deleteNote(noteTreeId, sourceId) {
    const noteTree = await sql.getFirstOrNull("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);

    if (!noteTree || noteTree.is_deleted === 1) {
        return;
    }

    const now = utils.nowDate();

    await sql.execute("UPDATE notes_tree SET is_deleted = 1, date_modified = ? WHERE note_tree_id = ?", [now, noteTreeId]);
    await sync_table.addNoteTreeSync(noteTreeId, sourceId);

    const noteId = await sql.getFirstValue("SELECT note_id FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]);

    const notDeletedNoteTreesCount = await sql.getFirstValue("SELECT COUNT(*) FROM notes_tree WHERE note_id = ? AND is_deleted = 0", [noteId]);

    if (!notDeletedNoteTreesCount) {
        await sql.execute("UPDATE notes SET is_deleted = 1, date_modified = ? WHERE note_id = ?", [now, noteId]);
        await sync_table.addNoteSync(noteId, sourceId);

        const children = await sql.getAll("SELECT note_tree_id FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0", [noteId]);

        for (const child of children) {
            await deleteNote(child.note_tree_id, sourceId);
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