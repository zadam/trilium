const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');
const app_info = require('./app_info');

const SYNCED_OPTIONS = [ 'username', 'password_verification_hash', 'encrypted_data_key', 'protected_session_timeout',
    'history_snapshot_time_interval' ];

async function getOption(optName) {
    const row = await sql.getSingleResultOrNull("SELECT opt_value FROM options WHERE opt_name = ?", [optName]);

    if (!row) {
        throwError("Option " + optName + " doesn't exist");
    }

    return row['opt_value'];
}

async function setOption(optName, optValue) {
    if (SYNCED_OPTIONS.includes(optName)) {
        await sync_table.addOptionsSync(optName);
    }

    await sql.replace("options", {
        opt_name: optName,
        opt_value: optValue,
        date_modified: utils.nowTimestamp()
    });
}

async function initOptions(startNoteTreeId) {
    await setOption('document_id', utils.randomSecureToken(16));
    await setOption('document_secret', utils.randomSecureToken(16));

    await setOption('username', '');
    await setOption('password_verification_hash', '');
    await setOption('password_verification_salt', '');
    await setOption('password_derived_key_salt', '');
    await setOption('encrypted_data_key', '');
    await setOption('encrypted_data_key_iv', '');

    await setOption('start_note_tree_id', startNoteTreeId);
    await setOption('protected_session_timeout', 600);
    await setOption('history_snapshot_time_interval', 600);
    await setOption('last_backup_date', utils.nowTimestamp());
    await setOption('db_version', app_info.db_version);

    await setOption('last_synced_pull', app_info.db_version);
    await setOption('last_synced_push', 0);
    await setOption('last_synced_push', 0);
}

module.exports = {
    getOption,
    setOption,
    initOptions,
    SYNCED_OPTIONS
};