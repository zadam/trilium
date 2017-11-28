const sql = require('./sql');
const utils = require('./utils');
const sync_table = require('./sync_table');

const SYNCED_OPTIONS = [ 'username', 'password_verification_hash', 'encrypted_data_key', 'protected_session_timeout',
    'history_snapshot_time_interval' ];

async function getOption(optName) {
    const row = await sql.getSingleResultOrNull("SELECT opt_value FROM options WHERE opt_name = ?", [optName]);

    if (!row) {
        throw new Error("Option " + optName + " doesn't exist");
    }

    return row['opt_value'];
}

async function setOption(db, optName, optValue) {
    if (SYNCED_OPTIONS.includes(optName)) {
        await sync_table.addOptionsSync(optName);
    }

    await setOptionNoSync(db, optName, optValue);
}

async function setOptionNoSync(db, optName, optValue) {
    const now = utils.nowTimestamp();

    await sql.execute(db, "UPDATE options SET opt_value = ?, date_modified = ? WHERE opt_name = ?", [optValue, now, optName]);
}

sql.dbReady.then(async () => {
    if (!await getOption('document_id') || !await getOption('document_secret')) {
        await sql.doInTransaction(async db => {
            await setOption(db, 'document_id', utils.randomSecureToken(16));
            await setOption(db, 'document_secret', utils.randomSecureToken(16));
        });
    }
});

module.exports = {
    getOption,
    setOption,
    SYNCED_OPTIONS
};