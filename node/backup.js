const utils = require('./utils');
const sql = require('./sql');
const config = require('./config');
const fs = require('fs-extra');

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

    const document_path = config.Document.documentPath;
    const backup_directory = config.Backup.backupDirectory;

    const date_str = new Date().toISOString().substr(0, 19);

    fs.copySync(document_path, backup_directory + "/" + "backup-" + date_str + ".db");

    await sql.setOption('last_backup_date', now);
    //await sql.commit();
}

async function cleanupOldBackups() {
    const now = new Date();
    const backupDirectory = config.Backup.backupDirectory;

    fs.readdirSync(backupDirectory).forEach(file => {
        const match = file.match(/backup-([0-9 -:]+)\.db/);

        if (match) {
            const date_str = match.group(1);

            const date = Date.parse(date_str);

            if (now.getTime() - date.getTime() > 30 * 24 * 3600 * 1000) {
                console.log("Removing old backup - " + file);

                fs.unlink(backupDirectory + "/" + file);
            }
        }
    });
}

module.exports = {
    regularBackup,
    backupNow
};