const sql = require('./sql');
const utils = require('./utils');
const options = require('./options');

function getHash(rows) {
    let hash = '';

    for (const row of rows) {
        hash = utils.hash(hash + JSON.stringify(row));
    }

    return hash;
}

async function getHashes() {
    const optionsQuestionMarks = Array(options.SYNCED_OPTIONS.length).fill('?').join(',');

    return {
        notes: getHash(await sql.getAll(`SELECT
                                                  note_id,
                                                  note_title,
                                                  note_text,
                                                  date_modified,
                                                  is_protected,
                                                  is_deleted
                                                FROM notes
                                                ORDER BY note_id`)),

        notes_tree: getHash(await sql.getAll(`SELECT
                                                       note_tree_id,
                                                       note_id,
                                                       parent_note_id,
                                                       note_position,
                                                       date_modified,
                                                       is_deleted,
                                                       prefix
                                                     FROM notes_tree
                                                     ORDER BY note_tree_id`)),

        notes_history: getHash(await sql.getAll(`SELECT
                                                          note_history_id,
                                                          note_id,
                                                          note_title,
                                                          note_text,
                                                          date_modified_from,
                                                          date_modified_to
                                                        FROM notes_history
                                                        ORDER BY note_history_id`)),

        recent_notes: getHash(await sql.getAll(`SELECT
                                                         note_tree_id,
                                                         note_path,
                                                         date_accessed,
                                                         is_deleted
                                                       FROM recent_notes
                                                       ORDER BY note_path`)),

        options: getHash(await sql.getAll(`SELECT 
                                                    opt_name,
                                                    opt_value 
                                                  FROM options 
                                                  WHERE opt_name IN (${optionsQuestionMarks}) 
                                                  ORDER BY opt_name`, options.SYNCED_OPTIONS))
    };
}

module.exports = {
    getHashes
};