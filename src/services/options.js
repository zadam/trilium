const repository = require('./repository');
const utils = require('./utils');
const dateUtils = require('./date_utils');
const appInfo = require('./app_info');
const Option = require('../entities/option');

async function getOption(name) {
    const option = await repository.getOption(name);

    if (!option) {
        throw new Error("Option " + name + " doesn't exist");
    }

    return option.value;
}

async function setOption(name, value) {
    const option = await repository.getOption(name);

    if (!option) {
        throw new Error(`Option ${name} doesn't exist`);
    }

    option.value = value;

    await option.save();
}

async function createOption(name, value, isSynced) {
    await new Option({
        name: name,
        value: value,
        isSynced: isSynced
    }).save();
}

async function initOptions(startNotePath) {
    await createOption('documentId', utils.randomSecureToken(16), false);
    await createOption('documentSecret', utils.randomSecureToken(16), false);

    await createOption('username', '', true);
    await createOption('passwordVerificationHash', '', true);
    await createOption('passwordVerificationSalt', '', true);
    await createOption('passwordDerivedKeySalt', '', true);
    await createOption('encryptedDataKey', '', true);
    await createOption('encryptedDataKeyIv', '', true);

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
    setOption,
    initOptions
};