"use strict";

const dataDir = require('./data_dir');
const dateUtils = require('./date_utils');
const fs = require('fs-extra');
const sqlite = require('sqlite');

async function anonymize() {
    if (!fs.existsSync(dataDir.ANONYMIZED_DB_DIR)) {
        fs.mkdirSync(dataDir.ANONYMIZED_DB_DIR, 0o700);
    }

    const anonymizedFile = dataDir.ANONYMIZED_DB_DIR + "/" + "anonymized-" + dateUtils.getDateTimeForFile() + ".db";

    fs.copySync(dataDir.DOCUMENT_PATH, anonymizedFile);

    const db = await sqlite.open(anonymizedFile, {Promise});

    await db.run("UPDATE notes SET title = 'title'");
    await db.run("UPDATE note_contents SET content = 'text'");
    await db.run("UPDATE note_revisions SET title = 'title', content = 'text'");
    await db.run("UPDATE branches SET prefix = 'prefix' WHERE prefix IS NOT NULL");
    await db.run(`UPDATE options SET value = 'anonymized' WHERE name IN 
                    ('documentSecret', 'encryptedDataKey', 'passwordVerificationHash', 
                     'passwordVerificationSalt', 'passwordDerivedKeySalt')`);
    await db.run("VACUUM");

    await db.close();

    return anonymizedFile;
}

module.exports = {
    anonymize
};