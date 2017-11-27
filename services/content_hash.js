const sql = require('./sql');
const utils = require('./utils');
const options = require('./options');

function updateHash(hash, rows) {
    for (const row of rows) {
        hash = utils.hash(hash + JSON.stringify(row));
    }

    return hash;
}

async function getContentHash() {
    let hash = '';

    hash = updateHash(hash, await sql.getResults("SELECT note_id, note_title, note_text, date_modified, is_protected, " +
        "is_deleted FROM notes ORDER BY note_id"));

    hash = updateHash(hash, await sql.getResults("SELECT note_tree_id, note_id, note_pid, note_pos, date_modified, " +
        "is_deleted, prefix FROM notes_tree ORDER BY note_tree_id"));

    hash = updateHash(hash, await sql.getResults("SELECT note_history_id, note_id, note_title, note_text, " +
        "date_modified_from, date_modified_to FROM notes_history ORDER BY note_history_id"));

    hash = updateHash(hash, await sql.getResults("SELECT note_path, date_accessed, is_deleted FROM recent_notes " +
        "ORDER BY note_path"));

    const questionMarks = Array(options.SYNCED_OPTIONS.length).fill('?').join(',');

    hash = updateHash(hash, await sql.getResults("SELECT opt_name, opt_value FROM options " +
        "WHERE opt_name IN (" + questionMarks + ") ORDER BY opt_name", options.SYNCED_OPTIONS));

    return hash;
}

module.exports = {
    getContentHash
};