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
        const noteIdsToDelete = await sql.getFirstColumn("SELECT note_id FROM notes WHERE is_deleted = 1");
        const noteIdsSql = noteIdsToDelete
            .map(noteId => "'" + utils.sanitizeSql(noteId) + "'")
            .join(', ');

        await sql.execute(`DELETE FROM event_log WHERE note_id IN (${noteIdsSql})`);

        await sql.execute(`DELETE FROM notes_history WHERE note_id IN (${noteIdsSql})`);

        await sql.execute("DELETE FROM notes_tree WHERE is_deleted = 1");

        await sql.execute("DELETE FROM notes_image WHERE is_deleted = 1");

        await sql.execute("DELETE FROM images WHERE is_deleted = 1");

        await sql.execute("DELETE FROM notes WHERE is_deleted = 1");

        await sql.execute("DELETE FROM recent_notes");

        await sync_table.cleanupSyncRowsForMissingEntities("notes", "note_id");
        await sync_table.cleanupSyncRowsForMissingEntities("notes_tree", "note_tree_id");
        await sync_table.cleanupSyncRowsForMissingEntities("notes_history", "note_history_id");
        await sync_table.cleanupSyncRowsForMissingEntities("recent_notes", "note_tree_id");

        log.info("Following notes has been completely cleaned from database: " + noteIdsSql);
    });

    res.send({});
}));

router.post('/cleanup-unused-images', auth.checkApiAuth, wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        const unusedImageIds = await sql.getFirstColumn(`
          SELECT images.image_id 
          FROM images 
            LEFT JOIN notes_image ON notes_image.image_id = images.image_id AND notes_image.is_deleted = 0
          WHERE
            images.is_deleted = 0
            AND notes_image.note_image_id IS NULL`);

        const now = utils.nowDate();

        for (const imageId of unusedImageIds) {
            log.info(`Deleting unused image: ${imageId}`);

            await sql.execute("UPDATE images SET is_deleted = 1, data = null, date_modified = ? WHERE image_id = ?",
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