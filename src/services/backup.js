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

const BACKUP_ATTEMPT_COUNT = 50;

async function backupNow(name) {
    const sql = require('./sql');

    // we don't want to backup DB in the middle of sync with potentially inconsistent DB state
    return await syncMutexService.doExclusively(async () => {
        const backupFile = `${dataDir.BACKUP_DIR}/backup-${name}.db`;

        try {
            fs.unlinkSync(backupFile);
        }
        catch (e) {} // unlink throws exception if the file did not exist

        let success = false;
        let attemptCount = 0

        for (; attemptCount < BACKUP_ATTEMPT_COUNT && !success; attemptCount++) {
            try {
                await sql.executeNoWrap(`VACUUM INTO '${backupFile}'`);
                success++;
            }
            catch (e) {
                log.info(`Backup attempt ${attemptCount + 1} failed with "${e.message}", retrying...`);
            }
            // we re-try since VACUUM is very picky and it can't run if there's any other query currently running
            // which is difficult to guarantee so we just re-try
        }

        if (attemptCount === BACKUP_ATTEMPT_COUNT) {
            log.error(`Creating backup ${backupFile} failed`);
        }
        else {
            log.info("Created backup at " + backupFile);
        }

        return backupFile;
    });
}

if (!fs.existsSync(dataDir.BACKUP_DIR)) {
    fs.mkdirSync(dataDir.BACKUP_DIR, 0o700);
}

sqlInit.dbReady.then(() => {
    setInterval(cls.wrap(regularBackup), 4 * 60 * 60 * 1000);

    // kickoff first backup soon after start up
    setTimeout(cls.wrap(regularBackup), 5 * 60 * 1000);
});

module.exports = {
    backupNow
};
