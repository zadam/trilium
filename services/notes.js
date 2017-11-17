const sql = require('./sql');
const options = require('./options');
const utils = require('./utils');
const notes = require('./notes');
const audit_category = require('./audit_category');
const data_encryption = require('./data_encryption');
const sync_table = require('./sync_table');

async function createNewNote(parentNoteId, note, browserId) {
    const noteId = utils.newNoteId();

    if (parentNoteId === "root") {
        parentNoteId = "";
    }

    let newNotePos = 0;

    if (note.target === 'into') {
        const res = await sql.getSingleResult('select max(note_pos) as max_note_pos from notes_tree where note_pid = ? and is_deleted = 0', [parentNoteId]);
        const maxNotePos = res['max_note_pos'];

        if (maxNotePos === null) // no children yet
            newNotePos = 0;
        else
            newNotePos = maxNotePos + 1
    }
    else if (note.target === 'after') {
        const afterNote = await sql.getSingleResult('select note_pos from notes_tree where note_id = ?', [note.target_note_id]);

        newNotePos = afterNote.note_pos + 1;

        const now = utils.nowTimestamp();

        await sql.execute('update notes_tree set note_pos = note_pos + 1, date_modified = ? where note_pid = ? and note_pos > ? and is_deleted = 0', [now, parentNoteId, afterNote['note_pos']]);
    }
    else {
        throw new Error('Unknown target: ' + note.target);
    }

    await sql.doInTransaction(async () => {
        await sql.addAudit(audit_category.CREATE_NOTE, browserId, noteId);
        await sync_table.addNoteTreeSync(noteId);
        await sync_table.addNoteSync(noteId);

        const now = utils.nowTimestamp();

        await sql.insert("notes", {
            'note_id': noteId,
            'note_title': note.note_title,
            'note_text': '',
            'date_created': now,
            'date_modified': now,
            'is_protected': note.is_protected
        });

        await sql.insert("notes_tree", {
            'note_id': noteId,
            'note_pid': parentNoteId,
            'note_pos': newNotePos,
            'is_expanded': 0,
            'date_modified': utils.nowTimestamp(),
            'is_deleted': 0
        });
    });
    return noteId;
}

async function encryptNote(note, ctx) {
    note.detail.note_title = data_encryption.encryptCbc(ctx.getDataKey(), data_encryption.noteTitleIv(note.detail.note_id), note.detail.note_title);
    note.detail.note_text = data_encryption.encryptCbc(ctx.getDataKey(), data_encryption.noteTextIv(note.detail.note_id), note.detail.note_text);
}

async function protectNoteRecursively(noteId, dataKey, protect) {
    const note = await sql.getSingleResult("SELECT * FROM notes WHERE note_id = ?", [noteId]);

    await protectNote(note, dataKey, protect);

    const children = await sql.getFlattenedResults("note_id", "SELECT note_id FROM notes_tree WHERE note_pid = ?", [noteId]);

    for (const childNoteId of children) {
        await protectNoteRecursively(childNoteId, dataKey, protect);
    }
}

async function protectNote(note, dataKey, protect) {
    let changed = false;

    if (protect && !note.is_protected) {
        note.note_title = data_encryption.encryptCbc(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
        note.note_text = data_encryption.encryptCbc(dataKey, data_encryption.noteTextIv(note.note_id), note.note_text);
        note.is_protected = true;

        changed = true;
    }
    else if (!protect && note.is_protected) {
        note.note_title = data_encryption.decryptCbcString(dataKey, data_encryption.noteTitleIv(note.note_id), note.note_title);
        note.note_text = data_encryption.decryptCbcString(dataKey, data_encryption.noteTextIv(note.note_id), note.note_text);
        note.is_protected = false;

        changed = true;
    }

    if (changed) {
        console.log("Updating...");

        await sql.execute("UPDATE notes SET note_title = ?, note_text = ?, is_protected = ? WHERE note_id = ?",
            [note.note_title, note.note_text, note.is_protected, note.note_id]);

        await sync_table.addNoteSync(note.note_id);
    }

    await protectNoteHistory(note.note_id, dataKey, protect);
}

async function protectNoteHistory(noteId, dataKey, protect) {
    const historyToChange = await sql.getResults("SELECT * FROM notes_history WHERE note_id = ? AND is_protected != ?", [noteId, protect]);

    for (const history of historyToChange) {
        if (protect) {
            history.note_title = data_encryption.encryptCbc(dataKey, data_encryption.noteTitleIv(history.note_history_id), history.note_title);
            history.note_text = data_encryption.encryptCbc(dataKey, data_encryption.noteTextIv(history.note_history_id), history.note_text);
            history.is_protected = true;
        }
        else {
            history.note_title = data_encryption.decryptCbcString(dataKey, data_encryption.noteTitleIv(history.note_history_id), history.note_title);
            history.note_text = data_encryption.decryptCbcString(dataKey, data_encryption.noteTextIv(history.note_history_id), history.note_text);
            history.is_protected = false;
        }

        await sql.execute("UPDATE notes_history SET note_title = ?, note_text = ?, is_protected = ? WHERE note_history_id = ?",
            [history.note_title, history.note_text, history.is_protected, history.note_history_id]);

        await sync_table.addNoteHistorySync(history.note_history_id);
    }
}

async function updateNote(noteId, newNote, ctx) {
    let noteTitleForHistory = newNote.detail.note_title;
    let noteTextForHistory = newNote.detail.note_text;

    if (newNote.detail.is_protected) {
        await encryptNote(newNote, ctx);
    }

    const origNoteDetail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    const now = utils.nowTimestamp();

    const historySnapshotTimeInterval = parseInt(await options.getOption('history_snapshot_time_interval'));

    const historyCutoff = now - historySnapshotTimeInterval;

    const existingNoteHistoryId = await sql.getSingleValue("select note_history_id from notes_history where note_id = ? and date_modified_from >= ?", [noteId, historyCutoff]);

    await sql.doInTransaction(async () => {
        if (!existingNoteHistoryId) {
            const newNoteHistoryId = utils.randomString(16);

            await sql.execute("insert into notes_history (note_history_id, note_id, note_title, note_text, is_protected, date_modified_from, date_modified_to) " +
                "values (?, ?, ?, ?, ?, ?, ?)", [
                newNoteHistoryId,
                noteId,
                noteTitleForHistory,
                noteTextForHistory,
                false, // we don't care about encryption - this will be handled in protectNoteHistory()
                now,
                now
            ]);

            await sync_table.addNoteHistorySync(newNoteHistoryId);
        }

        await protectNoteHistory(noteId, ctx.getDataKey(), newNote.detail.is_protected);

        await addNoteAudits(origNoteDetail, newNote.detail, ctx.browserId);

        await sql.execute("update notes set note_title = ?, note_text = ?, is_protected = ?, date_modified = ? where note_id = ?", [
            newNote.detail.note_title,
            newNote.detail.note_text,
            newNote.detail.is_protected,
            now,
            noteId]);

        await sql.remove("images", noteId);

        for (const img of newNote.images) {
            img.image_data = atob(img.image_data);

            await sql.insert("images", img);
        }

        await sql.remove("links", noteId);

        for (const link in newNote.links) {
            await sql.insert("links", link);
        }

        await sync_table.addNoteTreeSync(noteId);
        await sync_table.addNoteSync(noteId);
    });
}

async function addNoteAudits(origNote, newNote, browserId) {
    const noteId = newNote.note_id;

    if (!origNote || newNote.note_title !== origNote.note_title) {
        await sql.deleteRecentAudits(audit_category.UPDATE_TITLE, browserId, noteId);
        await sql.addAudit(audit_category.UPDATE_TITLE, browserId, noteId);
    }

    if (!origNote || newNote.note_text !== origNote.note_text) {
        await sql.deleteRecentAudits(audit_category.UPDATE_CONTENT, browserId, noteId);
        await sql.addAudit(audit_category.UPDATE_CONTENT, browserId, noteId);
    }

    if (!origNote || newNote.is_protected !== origNote.is_protected) {
        const origIsProtected = origNote ? origNote.is_protected : null;

        await sql.addAudit(audit_category.PROTECTED, browserId, noteId, origIsProtected, newNote.is_protected);
    }
}


async function deleteNote(noteId, browserId) {
    const now = utils.nowTimestamp();

    const children = await sql.getResults("select note_id from notes_tree where note_pid = ? and is_deleted = 0", [noteId]);

    for (const child of children) {
        await deleteNote(child.note_id, browserId);
    }

    await sql.execute("update notes_tree set is_deleted = 1, date_modified = ? where note_id = ?", [now, noteId]);
    await sql.execute("update notes set is_deleted = 1, date_modified = ? where note_id = ?", [now, noteId]);

    await sync_table.addNoteTreeSync(noteId);
    await sync_table.addNoteSync(noteId);

    await sql.addAudit(audit_category.DELETE_NOTE, browserId, noteId);
}

module.exports = {
    createNewNote,
    updateNote,
    addNoteAudits,
    deleteNote,
    protectNoteRecursively
};