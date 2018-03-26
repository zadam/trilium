const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');
const app_info = require('./app_info');

async function getOptionOrNull(name) {
    try {
        return await sql.getRowOrNull("SELECT value FROM options WHERE name = ?", [name]);
    }
    catch (e) {
        return await sql.getRowOrNull("SELECT opt_value FROM options WHERE opt_name = ?", [name]);
    }
}

async function getOption(name) {
    const row = await getOptionOrNull(name);

    if (!row) {
        throw new Error("Option " + name + " doesn't exist");
    }

    return row['value'] ? row['value'] : row['opt_value'];
}

async function setOption(name, value, sourceId = null) {
    let opt;

    try {
        opt = await sql.getRow("SELECT * FROM options WHERE name = ?", [name]);
    }
    catch (e) {
        opt = await sql.getRow("SELECT * FROM options WHERE opt_name = ?", [name]);
    }

    if (!opt) {
        throw new Error(`Option ${name} doesn't exist`);
    }

    if (opt.isSynced) {
        await sync_table.addOptionsSync(name, sourceId);
    }

    try {
        await sql.execute("UPDATE options SET value = ?, dateModified = ? WHERE name = ?",
            [value, utils.nowDate(), name]);
    }
    catch (e) {
        await sql.execute("UPDATE options SET opt_value = ?, date_modified = ? WHERE opt_name = ?",
            [value, utils.nowDate(), name]);
    }
}

async function createOption(name, value, isSynced, sourceId = null) {
    await sql.insert("options", {
        name: name,
        value: value,
        isSynced: isSynced,
        dateModified: utils.nowDate()
    });

    if (isSynced) {
        await sync_table.addOptionsSync(name, sourceId);
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