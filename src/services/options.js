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
    await createOption('documentId', utils.randomSecureToken(16), false);
    await createOption('documentSecret', utils.randomSecureToken(16), false);

    await createOption('username', '', true);
    await createOption('passwordVerificationHash', '', true);
    await createOption('passwordVerificationSalt', '', true);
    await createOption('passwordDerivedKeySalt', '', true);
    await createOption('encryptedDataKey', '', true);
    await createOption('encryptedDataKey_iv', '', true);

    await createOption('startNotePath', startNotePath, false);
    await createOption('protectedSessionTimeout', 600, true);
    await createOption('noteRevisionSnapshotTimeInterval', 600, true);
    await createOption('lastBackupDate', dateUtils.nowDate(), false);
    await createOption('dbVersion', appInfo.dbVersion, false);

    await createOption('lastSyncedPull', appInfo.dbVersion, false);
    await createOption('lastSyncedPush', 0, false);
}

module.exports = {
    getOption,
    getOptionOrNull,
    setOption,
    initOptions,
    createOption
};