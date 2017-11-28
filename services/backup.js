"use strict";

const utils = require('./utils');
const options = require('./options');
const fs = require('fs-extra');
const dataDir = require('./data_dir');
const log = require('./log');

async function regularBackup() {
    const now = utils.nowTimestamp();
    const last_backup_date = parseInt(await options.getOption('last_backup_date'));

    if (now - last_backup_date > 43200) {
        await backupNow();
    }

    await cleanupOldBackups();
}

async function backupNow() {
    const now = utils.nowTimestamp();

    const date_str = new Date().toISOString().substr(0, 19).replace(/:/g, '');

    const backupFile = dataDir.BACKUP_DIR + "/" + "backup-" + date_str + ".db";

    fs.copySync(dataDir.DOCUMENT_PATH, backupFile);

    log.info("Created backup at " + backupFile);

    await sql.doInTransaction(async db => {
        await options.setOption(db, 'last_backup_date', now);
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

setInterval(regularBackup, 60 * 60 * 1000);

// kickoff backup immediately
setTimeout(regularBackup, 1000);

module.exports = {
    backupNow
};