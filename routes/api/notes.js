"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const options = require('../../services/options');
const utils = require('../../services/utils');
const audit_category = require('../../services/audit_category');
const auth = require('../../services/auth');

router.get('/:noteId', auth.checkApiAuth, async (req, res, next) => {
    let noteId = req.params.noteId;

    await options.setOption('start_node', noteId);

    let detail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    if (detail.note_clone_id) {
        noteId = detail.note_clone_id;
        detail = sql.getSingleResult("select * from notes where note_id = ?", [noteId]);
    }

    res.send({
        detail: detail,
        images: await sql.getResults("select * from images where note_id = ? order by note_offset", [noteId]),
        loadTime: utils.nowTimestamp()
    });
});

router.put('/:noteId', async (req, res, next) => {
    let noteId = req.params.noteId;

    const detail = await sql.getSingleResult("select * from notes where note_id = ?", [noteId]);

    if (detail.note_clone_id) {
        noteId = detail.note_clone_id;
    }

    const note = req.body;

    const now = utils.nowTimestamp();

    const historySnapshotTimeInterval = parseInt(await options.getOption('history_snapshot_time_interval'));

    const historyCutoff = now - historySnapshotTimeInterval;

    let noteHistoryId = await sql.getSingleValue("select note_history_id from notes_history where note_id = ? and date_modified_from >= ?", [noteId, historyCutoff]);

    await sql.doInTransaction(async () => {
        if (noteHistoryId) {
            await sql.execute("update notes_history set note_title = ?, note_text = ?, encryption = ?, date_modified_to = ? where note_history_id = ?", [
                note.detail.note_title,
                note.detail.note_text,
                note.detail.encryption,
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
                note.detail.note_title,
                note.detail.note_text,
                note.detail.encryption,
                now,
                now
            ]);
        }

        await sql.addNoteHistorySync(noteHistoryId);

        if (note.detail.note_title !== detail.note_title) {
            await sql.deleteRecentAudits(audit_category.UPDATE_TITLE, req, noteId);
            await sql.addAudit(audit_category.UPDATE_TITLE, req, noteId);
        }

        if (note.detail.note_text !== detail.note_text) {
            await sql.deleteRecentAudits(audit_category.UPDATE_CONTENT, req, noteId);
            await sql.addAudit(audit_category.UPDATE_CONTENT, req, noteId);
        }

        if (note.detail.encryption !== detail.encryption) {
            await sql.addAudit(audit_category.ENCRYPTION, req, noteId, detail.encryption, note.detail.encryption);
        }

        await sql.execute("update notes set note_title = ?, note_text = ?, encryption = ?, date_modified = ? where note_id = ?", [
            note.detail.note_title,
            note.detail.note_text,
            note.detail.encryption,
            now,
            noteId]);

        await sql.remove("images", noteId);

        for (const img of note.images) {
            img.image_data = atob(img.image_data);

            await sql.insert("images", img);
        }

        await sql.remove("links", noteId);

        for (const link in note.links) {
            await sql.insert("links", link);
        }

        await sql.addNoteSync(noteId);
    });

    res.send({});
});

router.delete('/:noteId', async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await deleteNote(req.params.noteId, req);
    });

    res.send({});
});

async function deleteNote(noteId, req) {
    const now = utils.nowTimestamp();

    const children = await sql.getResults("select note_id from notes_tree where note_pid = ? and is_deleted = 0", [noteId]);

    for (const child of children) {
        await deleteNote(child.note_id);
    }

    await sql.execute("update notes_tree set is_deleted = 1, date_modified = ? where note_id = ?", [now, noteId]);
    await sql.execute("update notes set is_deleted = 1, date_modified = ? where note_id = ?", [now, noteId]);

    await sql.addAudit(audit_category.DELETE_NOTE, req, noteId);
}

router.post('/:parentNoteId/children', async (req, res, next) => {
    let parentNoteId = req.params.parentNoteId;

    const note = req.body;

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
        await sql.addAudit(audit_category.CREATE_NOTE, req, noteId);

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

    res.send({
        'note_id': noteId
    });
});

router.get('/', async (req, res, next) => {
    const search = '%' + req.query.search + '%';

    const result = await sql.getResults("select note_id from notes where note_title like ? or note_text like ?", [search, search]);

    const noteIdList = [];

    for (const res of result) {
        noteIdList.push(res.note_id);
    }

    res.send(noteIdList);
});

module.exports = router;