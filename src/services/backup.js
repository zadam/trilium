"use strict";

const dateUtils = require('./date_utils.js');
const optionService = require('./options.js');
const fs = require('fs-extra');
const dataDir = require('./data_dir.js');
const log = require('./log.js');
const syncMutexService = require('./sync_mutex.js');
const cls = require('./cls.js');
const sql = require('./sql.js');
const path = require('path');

function getExistingBackups() {
    if (!fs.existsSync(dataDir.BACKUP_DIR)) {
        return [];
    }

    return fs.readdirSync(dataDir.BACKUP_DIR)
        .filter(fileName => fileName.includes("backup"))
        .map(fileName => {
            const filePath = path.resolve(dataDir.BACKUP_DIR, fileName);
            const stat = fs.statSync(filePath)

            return {fileName, filePath, mtime: stat.mtime};
        });
}

function regularBackup() {
    cls.init(() => {
        periodBackup('lastDailyBackupDate', 'daily', 24 * 3600);

        periodBackup('lastWeeklyBackupDate', 'weekly', 7 * 24 * 3600);

        periodBackup('lastMonthlyBackupDate', 'monthly', 30 * 24 * 3600);
    });
}

function isBackupEnabled(backupType) {
    const optionName = `${backupType}BackupEnabled`;

    return optionService.getOptionBool(optionName);
}

function periodBackup(optionName, backupType, periodInSeconds) {
    if (!isBackupEnabled(backupType)) {
        return;
    }

    const now = new Date();
    const lastBackupDate = dateUtils.parseDateTime(optionService.getOption(optionName));

    if (now.getTime() - lastBackupDate.getTime() > periodInSeconds * 1000) {
        backupNow(backupType);

        optionService.setOption(optionName, dateUtils.utcNowDateTime());
    }
}

async function backupNow(name) {
    // we don't want to back up DB in the middle of sync with potentially inconsistent DB state
    return await syncMutexService.doExclusively(async () => {
        const backupFile = `${dataDir.BACKUP_DIR}/backup-${name}.db`;

        await sql.copyDatabase(backupFile);

        log.info(`Created backup at ${backupFile}`);

        return backupFile;
    });
}

if (!fs.existsSync(dataDir.BACKUP_DIR)) {
    fs.mkdirSync(dataDir.BACKUP_DIR, 0o700);
}

module.exports = {
    getExistingBackups,
    backupNow,
    regularBackup
};
