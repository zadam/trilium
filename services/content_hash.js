const sql = require('./sql');
const utils = require('./utils');
const options = require('./options');
const log = require('./log');

function getHash(rows) {
    let hash = '';

    for (const row of rows) {
        hash = utils.hash(hash + JSON.stringify(row));
    }

    return hash;
}

async function getHashes() {
    const startTime = new Date();

    const hashes = {
        notes: getHash(await sql.getAll(`
            SELECT
              noteId,
              title,
              content,
              type,
              dateModified,
              isProtected,
              isDeleted
            FROM notes
            ORDER BY noteId`)),

        notes_tree: getHash(await sql.getAll(`
            SELECT
               noteTreeId,
               noteId,
               parentNoteId,
               notePosition,
               dateModified,
               isDeleted,
               prefix
             FROM notes_tree
             ORDER BY noteTreeId`)),

        notes_history: getHash(await sql.getAll(`
            SELECT
              noteHistoryId,
              noteId,
              title,
              content,
              dateModifiedFrom,
              dateModifiedTo
            FROM notes_history
            ORDER BY noteHistoryId`)),

        recent_notes: getHash(await sql.getAll(`
           SELECT
             noteTreeId,
             notePath,
             dateAccessed,
             isDeleted
           FROM recent_notes
           ORDER BY notePath`)),

        options: getHash(await sql.getAll(`
           SELECT 
             name,
             value 
           FROM options 
           WHERE isSynced = 1
           ORDER BY name`)),

        // we don't include image data on purpose because they are quite large, checksum is good enough
        // to represent the data anyway
        images: getHash(await sql.getAll(`
          SELECT 
            imageId,
            format,
            checksum,
            name,
            isDeleted,
            dateModified,
            dateCreated
          FROM images  
          ORDER BY imageId`)),

        attributes: getHash(await sql.getAll(`
          SELECT 
            attributeId,
            noteId
            name,
            value
            dateModified,
            dateCreated
          FROM attributes  
          ORDER BY attributeId`))
    };

    const elapseTimeMs = new Date().getTime() - startTime.getTime();

    log.info(`Content hash computation took ${elapseTimeMs}ms`);

    return hashes;
}

module.exports = {
    getHashes
};