const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');
const app_info = require('./app_info');

async function getOptionOrNull(optName) {
    return await sql.getFirstOrNull("SELECT opt_value FROM options WHERE opt_name = ?", [optName]);
}

async function getOption(optName) {
    const row = await getOptionOrNull(optName);

    if (!row) {
        throw new Error("Option " + optName + " doesn't exist");
    }

    return row['opt_value'];
}

async function setOption(optName, optValue, sourceId = null) {
    const opt = await sql.getFirst("SELECT * FROM options WHERE opt_name = ?", [optName]);

    if (!opt) {
        throw new Error(`Option ${optName} doesn't exist`);
    }

    if (opt.is_synced) {
        await sync_table.addOptionsSync(optName, sourceId);
    }

    await sql.execute("UPDATE options SET opt_value = ?, date_modified = ? WHERE opt_name = ?",
        [optValue, utils.nowDate(), optName]);
}

async function createOption(optName, optValue, isSynced, sourceId = null) {
    await sql.insert("options", {
        opt_name: optName,
        opt_value: optValue,
        is_synced: isSynced,
        date_modified: utils.nowDate()
    });

    if (isSynced) {
        await sync_table.addOptionsSync(optName, sourceId);
    }
}

async function initOptions(startNotePath) {
    await createOption('document_id', utils.randomSecureToken(16), false);
    await createOption('document_secret', utils.randomSecureToken(16), false);

    await createOption('username', '', true);
    await createOption('password_verification_hash', '', true);
    await createOption('password_verification_salt', '', true);
    await createOption('password_derived_key_salt', '', true);
    await createOption('encrypted_data_key', '', true);
    await createOption('encrypted_data_key_iv', '', true);

    await createOption('start_note_path', startNotePath, false);
    await createOption('protected_session_timeout', 600, true);
    await createOption('history_snapshot_time_interval', 600, true);
    await createOption('last_backup_date', utils.nowDate(), false);
    await createOption('db_version', app_info.db_version, false);

    await createOption('last_synced_pull', app_info.db_version, false);
    await createOption('last_synced_push', 0, false);
}

module.exports = {
    getOption,
    getOptionOrNull,
    setOption,
    initOptions,
    createOption
};