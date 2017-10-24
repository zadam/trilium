"use strict";

const utils = require('./utils');
const sql = require('./sql');
const config = require('./config');
const fs = require('fs-extra');
const dataDir = require('./data_dir');

async function regularBackup() {
    const now = utils.nowTimestamp();
    const last_backup_date = parseInt(await sql.getOption('last_backup_date'));

    if (now - last_backup_date > 43200) {
        await backupNow();
    }

    await cleanupOldBackups();
}

async function backupNow() {
    const now = utils.nowTimestamp();

    const backup_directory = config.Backup.backupDirectory;

    const date_str = new Date().toISOString().substr(0, 19);

    if (!fs.existsSync(dataDir.BACKUP_DIR)) {
        fs.mkdirSync(dataDir.BACKUP_DIR, 0o700);
    }

    fs.copySync(dataDir.DOCUMENT_PATH, dataDir.BACKUP_DIR + "/" + "backup-" + date_str + ".db");

    await sql.setOption('last_backup_date', now);
    //await sql.commit();
}

async function cleanupOldBackups() {
    const now = new Date();

    fs.readdirSync(dataDir.BACKUP_DIR).forEach(file => {
        const match = file.match(/backup-([0-9 -:]+)\.db/);

        if (match) {
            const date_str = match[1];

            const date = Date.parse(date_str);

            if (now.getTime() - date.getTime() > 30 * 24 * 3600 * 1000) {
                console.log("Removing old backup - " + file);

                fs.unlink(dataDir.BACKUP_DIR + "/" + file);
            }
        }
    });
}

module.exports = {
    regularBackup,
    backupNow
};