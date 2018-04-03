const sql = require('./sql');
const utils = require('./utils');
const dateUtils = require('./date_utils');
const syncTableService = require('./sync_table');
const appInfo = require('./app_info');

async function getOptionOrNull(name) {
    return await sql.getRowOrNull("SELECT value FROM options WHERE name = ?", [name]);
}

async function getOption(name) {
    const row = await getOptionOrNull(name);

    if (!row) {
        throw new Error("Option " + name + " doesn't exist");
    }

    return row.value;
}

async function setOption(name, value) {
    const opt = await sql.getRow("SELECT * FROM options WHERE name = ?", [name]);

    if (!opt) {
        throw new Error(`Option ${name} doesn't exist`);
    }

    if (opt.isSynced) {
        await syncTableService.addOptionsSync(name);
    }

    await sql.execute("UPDATE options SET value = ?, dateModified = ? WHERE name = ?",
        [value, dateUtils.nowDate(), name]);
}

async function createOption(name, value, isSynced) {
    await sql.insert("options", {
        name: name,
        value: value,
        isSynced: isSynced,
        dateModified: dateUtils.nowDate()
    });

    if (isSynced) {
        await syncTableService.addOptionsSync(name);
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
    await createOption('note_revision_snapshot_time_interval', 600, true);
    await createOption('last_backup_date', dateUtils.nowDate(), false);
    await createOption('db_version', appInfo.db_version, false);

    await createOption('last_synced_pull', appInfo.db_version, false);
    await createOption('last_synced_push', 0, false);
}

module.exports = {
    getOption,
    getOptionOrNull,
    setOption,
    initOptions,
    createOption
};