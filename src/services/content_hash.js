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
        notes: getHash(await sql.getRows(`
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

        branches: getHash(await sql.getRows(`
            SELECT
               branchId,
               noteId,
               parentNoteId,
               notePosition,
               dateModified,
               isDeleted,
               prefix
             FROM branches
             ORDER BY branchId`)),

        note_revisions: getHash(await sql.getRows(`
            SELECT
              noteRevisionId,
              noteId,
              title,
              content,
              dateModifiedFrom,
              dateModifiedTo
            FROM note_revisions
            ORDER BY noteRevisionId`)),

        recent_notes: getHash(await sql.getRows(`
           SELECT
             branchId,
             notePath,
             dateAccessed,
             isDeleted
           FROM recent_notes
           ORDER BY notePath`)),

        options: getHash(await sql.getRows(`
           SELECT 
             name,
             value 
           FROM options 
           WHERE isSynced = 1
           ORDER BY name`)),

        // we don't include image data on purpose because they are quite large, checksum is good enough
        // to represent the data anyway
        images: getHash(await sql.getRows(`
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

        labels: getHash(await sql.getRows(`
          SELECT 
            labelId,
            noteId
            name,
            value
            dateModified,
            dateCreated
          FROM labels  
          ORDER BY labelId`))
    };

    const elapseTimeMs = new Date().getTime() - startTime.getTime();

    log.info(`Content hash computation took ${elapseTimeMs}ms`);

    return hashes;
}

module.exports = {
    getHashes
};