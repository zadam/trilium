"use strict";

const sql = require('../../services/sql');
const utils = require('../../services/utils');
const sync_table = require('../../services/sync_table');
const log = require('../../services/log');
const repository = require('../../services/repository');

async function cleanupSoftDeletedItems() {
    const noteIdsToDelete = await sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1");
    const noteIdsSql = noteIdsToDelete
        .map(noteId => "'" + utils.sanitizeSql(noteId) + "'")
        .join(', ');

    await sql.execute(`DELETE FROM event_log WHERE noteId IN (${noteIdsSql})`);

    await sql.execute(`DELETE FROM note_revisions WHERE noteId IN (${noteIdsSql})`);

    await sql.execute(`DELETE FROM note_images WHERE noteId IN (${noteIdsSql})`);

    await sql.execute(`DELETE FROM labels WHERE noteId IN (${noteIdsSql})`);

    await sql.execute("DELETE FROM branches WHERE isDeleted = 1");

    await sql.execute("DELETE FROM note_images WHERE isDeleted = 1");

    await sql.execute("DELETE FROM images WHERE isDeleted = 1");

    await sql.execute("DELETE FROM notes WHERE isDeleted = 1");

    await sql.execute("DELETE FROM recent_notes");

    await sync_table.cleanupSyncRowsForMissingEntities("notes", "noteId");
    await sync_table.cleanupSyncRowsForMissingEntities("branches", "branchId");
    await sync_table.cleanupSyncRowsForMissingEntities("note_revisions", "noteRevisionId");
    await sync_table.cleanupSyncRowsForMissingEntities("recent_notes", "branchId");
    await sync_table.cleanupSyncRowsForMissingEntities("images", "imageId");
    await sync_table.cleanupSyncRowsForMissingEntities("note_images", "noteImageId");
    await sync_table.cleanupSyncRowsForMissingEntities("labels", "labelId");

    log.info("Following notes has been completely cleaned from database: " + noteIdsSql);
}

async function cleanupUnusedImages() {
    const unusedImageIds = await sql.getColumn(`
      SELECT images.imageId 
      FROM images 
        LEFT JOIN note_images ON note_images.imageId = images.imageId AND note_images.isDeleted = 0
      WHERE
        images.isDeleted = 0
        AND note_images.noteImageId IS NULL`);

    const now = utils.nowDate();

    for (const imageId of unusedImageIds) {
        log.info(`Deleting unused image: ${imageId}`);

        const image = await repository.getImage(imageId);
        image.isDeleted = true;
        image.data = null;
        await image.save();
    }
}

async function vacuumDatabase() {
    await sql.execute("VACUUM");

    log.info("Database has been vacuumed.");
}

module.exports = {
    cleanupSoftDeletedItems,
    cleanupUnusedImages,
    vacuumDatabase
};