const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');
const app_info = require('./app_info');

const SYNCED_OPTIONS = [ 'username', 'password_verification_hash', 'password_verification_salt',
    'password_derived_key_salt', 'encrypted_data_key', 'encrypted_data_key_iv',
    'protected_session_timeout', 'history_snapshot_time_interval' ];

async function getOption(optName) {
    const row = await sql.getFirstOrNull("SELECT opt_value FROM options WHERE opt_name = ?", [optName]);

    if (!row) {
        throw new Error("Option " + optName + " doesn't exist");
    }

    return row['opt_value'];
}

async function setOption(optName, optValue, sourceId) {
    if (SYNCED_OPTIONS.includes(optName)) {
        await sync_table.addOptionsSync(optName, sourceId);
    }

    await sql.replace("options", {
        opt_name: optName,
        opt_value: optValue,
        date_modified: utils.nowDate()
    });
}

async function initOptions(startNotePath) {
    await setOption('document_id', utils.randomSecureToken(16));
    await setOption('document_secret', utils.randomSecureToken(16));

    await setOption('username', '');
    await setOption('password_verification_hash', '');
    await setOption('password_verification_salt', '');
    await setOption('password_derived_key_salt', '');
    await setOption('encrypted_data_key', '');
    await setOption('encrypted_data_key_iv', '');

    await setOption('start_note_path', startNotePath);
    await setOption('protected_session_timeout', 600);
    await setOption('history_snapshot_time_interval', 600);
    await setOption('last_backup_date', utils.nowDate());
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