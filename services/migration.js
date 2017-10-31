const backup = require('./backup');
const sql = require('./sql');
const fs = require('fs-extra');
const log = require('./log');

const APP_DB_VERSION = 22;
const MIGRATIONS_DIR = "./migrations";

async function migrate() {
    const migrations = [];

    // backup before attempting migration
    await backup.backupNow();

    const currentDbVersion = parseInt(await sql.getOption('db_version'));

    fs.readdirSync(MIGRATIONS_DIR).forEach(file => {
        const match = file.match(/([0-9]{4})__([a-zA-Z0-9_ ]+)\.sql/);

        if (match) {
            const dbVersion = parseInt(match[1]);

            if (dbVersion > currentDbVersion) {
                const name = match[2];

                const migrationRecord = {
                    dbVersion: dbVersion,
                    name: name,
                    file: file
                };

                migrations.push(migrationRecord);
            }
        }
    });

    migrations.sort((a, b) => a.db_version - b.db_version);

    for (const mig of migrations) {
        const migrationSql = fs.readFileSync(MIGRATIONS_DIR + "/" + mig.file).toString('utf8');

        try {
            log.info("Attempting migration to version " + mig.dbVersion + " with script: " + migrationSql);

            await sql.doInTransaction(async () => {
                await sql.executeScript(migrationSql);

                await sql.setOption("db_version", mig.dbVersion);
            });

            log.info("Migration to version " + mig.dbVersion + " has been successful.");

            mig['success'] = true;
        }
        catch (e) {
            mig['success'] = false;
            mig['error'] = e.stack;

            log.error("error during migration to version " + mig.dbVersion + ": " + e.stack);

            break;
        }
    }

    return migrations;
}

async function isDbUpToDate() {
    const dbVersion = parseInt(await sql.getOption('db_version'));

    return dbVersion >= APP_DB_VERSION;
}

module.exports = {
    migrate,
    isDbUpToDate,
    APP_DB_VERSION
};