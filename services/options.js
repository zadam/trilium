const sql = require('./sql');
const utils = require('./utils');

const SYNCED_OPTIONS = [ 'username', 'password_verification_hash', 'encrypted_data_key', 'encryption_session_timeout',
    'history_snapshot_time_interval' ];

async function getOption(optName) {
    const row = await sql.getSingleResultOrNull("SELECT opt_value FROM options WHERE opt_name = ?", [optName]);

    if (!row) {
        throw new Error("Option " + optName + " doesn't exist");
    }

    return row['opt_value'];
}

async function setOptionInTransaction(optName, optValue) {
    await sql.doInTransaction(async () => setOption(optName, optValue));
}

async function setOption(optName, optValue) {
    if (SYNCED_OPTIONS.includes(optName)) {
        await sql.addOptionsSync(optName);
    }

    await setOptionNoSync(optName, optValue);
}

async function setOptionNoSync(optName, optValue) {
    const now = utils.nowTimestamp();

    await sql.execute("UPDATE options SET opt_value = ?, date_modified = ? WHERE opt_name = ?", [optValue, now, optName]);
}

module.exports = {
    getOption,
    setOption,
    setOptionNoSync,
    setOptionInTransaction,
    SYNCED_OPTIONS
};