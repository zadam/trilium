"use strict";

const dateUtils = require('./date_utils');
const optionService = require('./options');
const fs = require('fs-extra');
const dataDir = require('./data_dir');
const log = require('./log');
const sqlInit = require('./sql_init');
const syncMutexService = require('./sync_mutex');
const attributeService = require('./attributes');
const cls = require('./cls');
const utils = require('./utils');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

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

const COPY_ATTEMPT_COUNT = 50;

async function copyFile(backupFile) {
    const sql = require('./sql');

    try {
        fs.unlinkSync(backupFile);
    } catch (e) {
    } // unlink throws exception if the file did not exist

    let success = false;
    let attemptCount = 0

    for (; attemptCount < COPY_ATTEMPT_COUNT && !success; attemptCount++) {
        try {
            await sql.executeWithoutTransaction(`VACUUM INTO '${backupFile}'`);

            success = true;
        } catch (e) {
            log.info(`Copy DB attempt ${attemptCount + 1} failed with "${e.message}", retrying...`);
        }
        // we re-try since VACUUM is very picky and it can't run if there's any other query currently running
        // which is difficult to guarantee so we just re-try
    }

    return attemptCount !== COPY_ATTEMPT_COUNT;
}

async function backupNow(name) {
    // we don't want to backup DB in the middle of sync with potentially inconsistent DB state
    return await syncMutexService.doExclusively(async () => {
        const backupFile = `${dataDir.BACKUP_DIR}/backup-${name}.db`;

        const success = await copyFile(backupFile);

        if (success) {
            log.info("Created backup at " + backupFile);
        }
        else {
            log.error(`Creating backup ${backupFile} failed`);
        }

        return backupFile;
    });
}

async function anonymize() {
    if (!fs.existsSync(dataDir.ANONYMIZED_DB_DIR)) {
        fs.mkdirSync(dataDir.ANONYMIZED_DB_DIR, 0o700);
    }

    const anonymizedFile = dataDir.ANONYMIZED_DB_DIR + "/" + "anonymized-" + dateUtils.getDateTimeForFile() + ".db";

    const success = await copyFile(anonymizedFile);

    if (!success) {
        return { success: false };
    }

    const db = await sqlite.open({
        filename: anonymizedFile,
        driver: sqlite3.Database
    });

    await db.run("UPDATE api_tokens SET token = 'API token value'");
    await db.run("UPDATE notes SET title = 'title'");
    await db.run("UPDATE note_contents SET content = 'text' WHERE content IS NOT NULL");
    await db.run("UPDATE note_revisions SET title = 'title'");
    await db.run("UPDATE note_revision_contents SET content = 'text' WHERE content IS NOT NULL");

    // we want to delete all non-builtin attributes because they can contain sensitive names and values
    // on the other hand builtin/system attrs should not contain any sensitive info
    const builtinAttrs = attributeService.getBuiltinAttributeNames().map(name => "'" + utils.sanitizeSql(name) + "'").join(', ');

    await db.run(`UPDATE attributes SET name = 'name', value = 'value' WHERE type = 'label' AND name NOT IN(${builtinAttrs})`);
    await db.run(`UPDATE attributes SET name = 'name' WHERE type = 'relation' AND name NOT IN (${builtinAttrs})`);
    await db.run("UPDATE branches SET prefix = 'prefix' WHERE prefix IS NOT NULL");
    await db.run(`UPDATE options SET value = 'anonymized' WHERE name IN 
                    ('documentId', 'documentSecret', 'encryptedDataKey', 
                     'passwordVerificationHash', 'passwordVerificationSalt', 
                     'passwordDerivedKeySalt', 'username', 'syncServerHost', 'syncProxy') 
                      AND value != ''`);
    await db.run("VACUUM");

    await db.close();

    return {
        success: true,
        anonymizedFilePath: anonymizedFile
    };
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
    backupNow,
    anonymize
};
