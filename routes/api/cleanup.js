"use strict";

const express = require('express');
const router = express.Router();
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const auth = require('../../services/auth');
const log = require('../../services/log');
const wrap = require('express-promise-wrap').wrap;

router.post('/cleanup-soft-deleted-items', auth.checkApiAuth, wrap(async (req, res, next) => {
    await sql.doInTransaction(async () => {
        const noteIdsToDelete = await sql.getFirstColumn("SELECT noteId FROM notes WHERE isDeleted = 1");
        const noteIdsSql = noteIdsToDelete
            .map(noteId => "'" + utils.sanitizeSql(noteId) + "'")
            .join(', ');

        await sql.execute(`DELETE FROM event_log WHERE noteId IN (${noteIdsSql})`);

        await sql.execute(`DELETE FROM note_revisions WHERE noteId IN (${noteIdsSql})`);

        await sql.execute(`DELETE FROM note_images WHERE noteId IN (${noteIdsSql})`);

        await sql.execute(`DELETE FROM attributes WHERE noteId IN (${noteIdsSql})`);

        await sql.execute("DELETE FROM note_tree WHERE isDeleted = 1");

        await sql.execute("DELETE FROM note_images WHERE isDeleted = 1");

        await sql.execute("DELETE FROM images WHERE isDeleted = 1");

        await sql.execute("DELETE FROM notes WHERE isDeleted = 1");

        await sql.execute("DELETE FROM recent_notes");

        await sync_table.cleanupSyncRowsForMissingEntities("notes", "noteId");
        await sync_table.cleanupSyncRowsForMissingEntities("note_tree", "noteTreeId");
        await sync_table.cleanupSyncRowsForMissingEntities("note_revisions", "noteRevisionId");
        await sync_table.cleanupSyncRowsForMissingEntities("recent_notes", "noteTreeId");

        log.info("Following notes has been completely cleaned from database: " + noteIdsSql);
    });

    res.send({});
}));

router.post('/cleanup-unused-images', auth.checkApiAuth, wrap(async (req, res, next) => {
    const sourceId = req.headers.sourceId;

    await sql.doInTransaction(async () => {
        const unusedImageIds = await sql.getFirstColumn(`
          SELECT images.imageId 
          FROM images 
            LEFT JOIN note_images ON note_images.imageId = images.imageId AND note_images.isDeleted = 0
          WHERE
            images.isDeleted = 0
            AND note_images.noteImageId IS NULL`);

        const now = utils.nowDate();

        for (const imageId of unusedImageIds) {
            log.info(`Deleting unused image: ${imageId}`);

            await sql.execute("UPDATE images SET isDeleted = 1, data = null, dateModified = ? WHERE imageId = ?",
                [now, imageId]);

            await sync_table.addImageSync(imageId, sourceId);
        }
    });

    res.send({});
}));

router.post('/vacuum-database', auth.checkApiAuth, wrap(async (req, res, next) => {
    await sql.execute("VACUUM");

    log.info("Database has been vacuumed.");

    res.send({});
}));

module.exports = router;