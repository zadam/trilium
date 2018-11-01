"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');
const repository = require('../../services/repository');

async function cleanupUnusedImages() {
    const unusedImages = await repository.getEntities(`
      SELECT images.* 
      FROM images 
        LEFT JOIN note_images ON note_images.imageId = images.imageId AND note_images.isDeleted = 0
      WHERE
        images.isDeleted = 0
        AND note_images.noteImageId IS NULL`);

    for (const image of unusedImages) {
        log.info(`Deleting unused image: ${image.imageId}`);

        image.isDeleted = true;
        image.data = null;
        await image.save();
    }
}

async function vacuumDatabase() {
    await sql.execute("VACUUM");

    log.info("Database has been vacuumed.");
}

// Running this periodically is a bit dangerous because it is possible during the normal usage
// that user removed image from its only note, but keeps its URL in clipboard and pastes it into
// a different note. If this cleanup happens during this moment, we delete the image before new note_images
// reference is created. But currently we don't have a better way to do this.
setInterval(cleanupUnusedImages, 4 * 3600 * 1000);

module.exports = {
    cleanupUnusedImages,
    vacuumDatabase
};