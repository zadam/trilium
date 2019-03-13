"use strict";

const dateUtils = require('./date_utils');
const optionService = require('./options');
const fs = require('fs-extra');
const dataDir = require('./data_dir');
const log = require('./log');
const sqlInit = require('./sql_init');
const syncMutexService = require('./sync_mutex');
const cls = require('./cls');

async function regularBackup() {
    await periodBackup('lastDailyBackupDate', 'daily', 24 * 3600);

    await periodBackup('lastWeeklyBackupDate', 'weekly', 7 * 24 * 3600);

    await periodBackup('lastMonthlyBackupDate', 'monthly', 30 * 24 * 3600);
}

async function periodBackup(optionName, fileName, periodInSeconds) {
    const now = new Date();
    const lastDailyBackupDate = dateUtils.parseDateTime(await optionService.getOption(optionName));

    if (now.getTime() - lastDailyBackupDate.getTime() > periodInSeconds * 1000) {
        await backupNow(fileName);

        await optionService.setOption(optionName, dateUtils.utcNowDateTime());
    }
}

async function backupNow(name) {
    // we don't want to backup DB in the middle of sync with potentially inconsistent DB state
    await syncMutexService.doExclusively(async () => {
        const backupFile = `${dataDir.BACKUP_DIR}/backup-${name}.db`;

        fs.copySync(dataDir.DOCUMENT_PATH, backupFile);

        log.info("Created backup at " + backupFile);
    });
}

if (!fs.existsSync(dataDir.BACKUP_DIR)) {
    fs.mkdirSync(dataDir.BACKUP_DIR, 0o700);
}

sqlInit.dbReady.then(() => {
    setInterval(cls.wrap(regularBackup), 60 * 60 * 1000);

    // kickoff backup immediately
    setTimeout(cls.wrap(regularBackup), 1000);
});

module.exports = {
    backupNow
};