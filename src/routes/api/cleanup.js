"use strict";

const sql = require('../../services/sql');
const log = require('../../services/log');
const repository = require('../../services/repository');

async function cleanupUnusedImages() {
    const unusedImageIds = await sql.getColumn(`
      SELECT images.imageId 
      FROM images 
        LEFT JOIN note_images ON note_images.imageId = images.imageId AND note_images.isDeleted = 0
      WHERE
        images.isDeleted = 0
        AND note_images.noteImageId IS NULL`);

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
    cleanupUnusedImages,
    vacuumDatabase
};