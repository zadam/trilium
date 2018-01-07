"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sync = require('../../services/sync');
const syncUpdate = require('../../services/sync_update');
const sync_table = require('../../services/sync_table');
const sql = require('../../services/sql');
const options = require('../../services/options');
const content_hash = require('../../services/content_hash');
const log = require('../../services/log');

router.get('/check', auth.checkApiAuth, async (req, res, next) => {
    res.send({
        'hashes': await content_hash.getHashes(),
        'max_sync_id': await sql.getFirstValue('SELECT MAX(id) FROM sync')
    });
});

router.post('/now', auth.checkApiAuth, async (req, res, next) => {
    res.send(await sync.sync());
});

router.post('/fill-sync-rows', auth.checkApiAuth, async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await sync_table.fillAllSyncRows();
    });

    log.info("Sync rows have been filled.");

    res.send({});
});

router.post('/force-full-sync', auth.checkApiAuth, async (req, res, next) => {
    await sql.doInTransaction(async () => {
        await options.setOption('last_synced_pull', 0);
        await options.setOption('last_synced_push', 0);
    });

    log.info("Forcing full sync.");

    // not awaiting for the job to finish (will probably take a long time)
    sync.sync();

    res.send({});
});

router.post('/force-note-sync/:noteId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;

    await sql.doInTransaction(async () => {
        await sync_table.addNoteSync(noteId);

        for (const noteTreeId of await sql.getFirstColumn("SELECT note_tree_id FROM notes_tree WHERE is_deleted = 0 AND note_id = ?", [noteId])) {
            await sync_table.addNoteTreeSync(noteTreeId);
            await sync_table.addRecentNoteSync(noteTreeId);
        }

        for (const noteHistoryId of await sql.getFirstColumn("SELECT note_history_id FROM notes_history WHERE note_id = ?", [noteId])) {
            await sync_table.addNoteHistorySync(noteHistoryId);
        }
    });

    log.info("Forcing note sync for " + noteId);

    // not awaiting for the job to finish (will probably take a long time)
    sync.sync();

    res.send({});
});

router.get('/changed', auth.checkApiAuth, async (req, res, next) => {
    const lastSyncId = parseInt(req.query.lastSyncId);

    res.send(await sql.getAll("SELECT * FROM sync WHERE id > ?", [lastSyncId]));
});

router.get('/notes/:noteId', auth.checkApiAuth, async (req, res, next) => {
    const noteId = req.params.noteId;

    res.send({
        entity: await sql.getFirst("SELECT * FROM notes WHERE note_id = ?", [noteId])
    });
});

router.get('/notes_tree/:noteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;

    res.send(await sql.getFirst("SELECT * FROM notes_tree WHERE note_tree_id = ?", [noteTreeId]));
});

router.get('/notes_history/:noteHistoryId', auth.checkApiAuth, async (req, res, next) => {
    const noteHistoryId = req.params.noteHistoryId;

    res.send(await sql.getFirst("SELECT * FROM notes_history WHERE note_history_id = ?", [noteHistoryId]));
});

router.get('/options/:optName', auth.checkApiAuth, async (req, res, next) => {
    const optName = req.params.optName;

    if (!options.SYNCED_OPTIONS.includes(optName)) {
        res.send("This option can't be synced.");
    }
    else {
        res.send(await sql.getFirst("SELECT * FROM options WHERE opt_name = ?", [optName]));
    }
});

router.get('/notes_reordering/:noteTreeParentId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeParentId = req.params.noteTreeParentId;

    res.send({
        parent_note_id: noteTreeParentId,
        ordering: await sql.getMap("SELECT note_tree_id, note_position FROM notes_tree WHERE parent_note_id = ? AND is_deleted = 0", [noteTreeParentId])
    });
});

router.get('/recent_notes/:noteTreeId', auth.checkApiAuth, async (req, res, next) => {
    const noteTreeId = req.params.noteTreeId;

    res.send(await sql.getFirst("SELECT * FROM recent_notes WHERE note_tree_id = ?", [noteTreeId]));
});

router.get('/images/:imageId', auth.checkApiAuth, async (req, res, next) => {
    const imageId = req.params.imageId;
    const entity = await sql.getFirst("SELECT * FROM images WHERE image_id = ?", [imageId]);

    if (entity && entity.data !== null) {
        entity.data = entity.data.toString('base64');
    }

    res.send(entity);
});

router.get('/notes_image/:noteImageId', auth.checkApiAuth, async (req, res, next) => {
    const noteImageId = req.params.noteImageId;

    res.send(await sql.getFirst("SELECT * FROM notes_image WHERE note_image_id = ?", [noteImageId]));
});

router.put('/notes', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateNote(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/notes_tree', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateNoteTree(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/notes_history', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateNoteHistory(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/notes_reordering', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateNoteReordering(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/options', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateOptions(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/recent_notes', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateRecentNotes(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/images', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateImage(req.body.entity, req.body.sourceId);

    res.send({});
});

router.put('/notes_image', auth.checkApiAuth, async (req, res, next) => {
    await syncUpdate.updateNoteImage(req.body.entity, req.body.sourceId);

    res.send({});
});

module.exports = router;