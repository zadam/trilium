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
              note_id,
              note_title,
              note_text,
              type,
              date_modified,
              is_protected,
              is_deleted
            FROM notes
            ORDER BY note_id`)),

        notes_tree: getHash(await sql.getAll(`
            SELECT
               note_tree_id,
               note_id,
               parent_note_id,
               note_position,
               date_modified,
               is_deleted,
               prefix
             FROM notes_tree
             ORDER BY note_tree_id`)),

        notes_history: getHash(await sql.getAll(`
            SELECT
              note_history_id,
              note_id,
              note_title,
              note_text,
              date_modified_from,
              date_modified_to
            FROM notes_history
            ORDER BY note_history_id`)),

        recent_notes: getHash(await sql.getAll(`
           SELECT
             note_tree_id,
             note_path,
             date_accessed,
             is_deleted
           FROM recent_notes
           ORDER BY note_path`)),

        options: getHash(await sql.getAll(`
           SELECT 
             opt_name,
             opt_value 
           FROM options 
           WHERE is_synced = 1
           ORDER BY opt_name`)),

        // we don't include image data on purpose because they are quite large, checksum is good enough
        // to represent the data anyway
        images: getHash(await sql.getAll(`
          SELECT 
            image_id,
            format,
            checksum,
            name,
            is_deleted,
            date_modified,
            date_created
          FROM images  
          ORDER BY image_id`)),

        attributes: getHash(await sql.getAll(`
          SELECT 
            attribute_id,
            note_id
            name,
            value
            date_modified,
            date_created
          FROM attributes  
          ORDER BY attribute_id`))
    };

    const elapseTimeMs = new Date().getTime() - startTime.getTime();

    log.info(`Content hash computation took ${elapseTimeMs}ms`);

    return hashes;
}

module.exports = {
    getHashes
};