const sql = require('./sql');
const options = require('./options');
const utils = require('./utils');
const notes = require('./notes');
const audit_category = require('./audit_category');

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

        const now = utils.nowTimestamp();

        await sql.insert("notes", {
            'note_id': noteId,
            'note_title': note.note_title,
            'note_text': '',
            'note_clone_id': '',
            'date_created': now,
            'date_modified': now,
            'encryption': note.encryption
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

async function updateNote(noteId, newNote, browserId) {
    const origNoteDetail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    if (origNoteDetail.note_clone_id) {
        noteId = origNoteDetail.note_clone_id;
    }


    const now = utils.nowTimestamp();

    const historySnapshotTimeInterval = parseInt(await options.getOption('history_snapshot_time_interval'));

    const historyCutoff = now - historySnapshotTimeInterval;

    let noteHistoryId = await sql.getSingleValue("select note_history_id from notes_history where note_id = ? and date_modified_from >= ?", [noteId, historyCutoff]);

    await sql.doInTransaction(async () => {
        if (noteHistoryId) {
            await sql.execute("update notes_history set note_title = ?, note_text = ?, encryption = ?, date_modified_to = ? where note_history_id = ?", [
                newNote.detail.note_title,
                newNote.detail.note_text,
                newNote.detail.encryption,
                now,
                noteHistoryId
            ]);
        }
        else {
            noteHistoryId = utils.randomString(16);

            await sql.execute("insert into notes_history (note_history_id, note_id, note_title, note_text, encryption, date_modified_from, date_modified_to) " +
                "values (?, ?, ?, ?, ?, ?, ?)", [
                noteHistoryId,
                noteId,
                newNote.detail.note_title,
                newNote.detail.note_text,
                newNote.detail.encryption,
                now,
                now
            ]);
        }

        await sql.addNoteHistorySync(noteHistoryId);
        await addNoteAudits(origNoteDetail, newNote.detail, browserId);

        await sql.execute("update notes set note_title = ?, note_text = ?, encryption = ?, date_modified = ? where note_id = ?", [
            newNote.detail.note_title,
            newNote.detail.note_text,
            newNote.detail.encryption,
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

        await sql.addNoteSync(noteId);
    });
}

async function addNoteAudits(origNote, newNote, browserId) {
    const noteId = origNote.note_id;

    if (newNote.note_title !== origNote.note_title) {
        await sql.deleteRecentAudits(audit_category.UPDATE_TITLE, browserId, noteId);
        await sql.addAudit(audit_category.UPDATE_TITLE, browserId, noteId);
    }

    if (newNote.note_text !== origNote.note_text) {
        await sql.deleteRecentAudits(audit_category.UPDATE_CONTENT, browserId, noteId);
        await sql.addAudit(audit_category.UPDATE_CONTENT, browserId, noteId);
    }

    if (newNote.encryption !== origNote.encryption) {
        await sql.addAudit(audit_category.ENCRYPTION, browserId, noteId, origNote.encryption, newNote.encryption);
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

    await sql.addAudit(audit_category.DELETE_NOTE, browserId, noteId);
}

module.exports = {
    createNewNote,
    updateNote,
    addNoteAudits,
    deleteNote
}