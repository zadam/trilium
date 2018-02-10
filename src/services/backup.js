"use strict";

const utils = require('./utils');
const options = require('./options');
const fs = require('fs-extra');
const dataDir = require('./data_dir');
const log = require('./log');
const sql = require('./sql');
const sync_mutex = require('./sync_mutex');

async function regularBackup() {
    const now = new Date();
    const lastBackupDate = utils.parseDateTime(await options.getOption('last_backup_date'));

    console.log(lastBackupDate);

    if (now.getTime() - lastBackupDate.getTime() > 43200 * 1000) {
        await backupNow();
    }

    await cleanupOldBackups();
}

async function backupNow() {
    // we don't want to backup DB in the middle of sync with potentially inconsistent DB state

    await sync_mutex.doExclusively(async () => {
        const now = utils.nowDate();

        const backupFile = dataDir.BACKUP_DIR + "/" + "backup-" + utils.getDateTimeForFile() + ".db";

        fs.copySync(dataDir.DOCUMENT_PATH, backupFile);

        log.info("Created backup at " + backupFile);

        await sql.doInTransaction(async () => {
            await options.setOption('last_backup_date', now);
        });
    });
}

async function cleanupOldBackups() {
    const now = new Date();

    fs.readdirSync(dataDir.BACKUP_DIR).forEach(file => {
        const match = file.match(/backup-([0-9 -:]+)\.db/);

        if (match) {
            const date_str = match[1];

            const date = Date.parse(date_str);

            if (now.getTime() - date.getTime() > 30 * 24 * 3600 * 1000) {
                log.info("Removing old backup - " + file);

                fs.unlink(dataDir.BACKUP_DIR + "/" + file);
            }
        }
    });
}

if (!fs.existsSync(dataDir.BACKUP_DIR)) {
    fs.mkdirSync(dataDir.BACKUP_DIR, 0o700);
}

sql.dbReady.then(() => {
    setInterval(regularBackup, 60 * 60 * 1000);

    // kickoff backup immediately
    setTimeout(regularBackup, 1000);
});

module.exports = {
    backupNow
};