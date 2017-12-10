const backup = require('./backup');
const sql = require('./sql');
const options = require('./options');
const fs = require('fs-extra');
const log = require('./log');
const app_info = require('./app_info');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

if (!fs.existsSync(MIGRATIONS_DIR)) {
    log.error("Could not find migration directory: " + MIGRATIONS_DIR);
    process.exit(1);
}

async function migrate() {
    const migrations = [];

    // backup before attempting migration
    await backup.backupNow();

    const currentDbVersion = parseInt(await options.getOption('db_version'));

    fs.readdirSync(MIGRATIONS_DIR).forEach(file => {
        const match = file.match(/([0-9]{4})__([a-zA-Z0-9_ ]+)\.(sql|js)/);

        if (match) {
            const dbVersion = parseInt(match[1]);

            if (dbVersion > currentDbVersion) {
                const name = match[2];
                const type = match[3];

                const migrationRecord = {
                    dbVersion: dbVersion,
                    name: name,
                    file: file,
                    type: type
                };

                migrations.push(migrationRecord);
            }
        }
    });

    migrations.sort((a, b) => a.dbVersion - b.dbVersion);

    for (const mig of migrations) {
        try {
            log.info("Attempting migration to version " + mig.dbVersion);

            await sql.doInTransaction(async () => {
                if (mig.type === 'sql') {
                    const migrationSql = fs.readFileSync(MIGRATIONS_DIR + "/" + mig.file).toString('utf8');

                    console.log("Migration with SQL script: " + migrationSql);

                    await sql.executeScript(migrationSql);
                }
                else if (mig.type === 'js') {
                    console.log("Migration with JS module");

                    const migrationModule = require("../" + MIGRATIONS_DIR + "/" + mig.file);
                    await migrationModule(db);
                }
                else {
                    throw new Error("Unknown migration type " + mig.type);
                }

                await options.setOption("db_version", mig.dbVersion);
            });

            sql.setDbReadyAsResolved();

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

module.exports = {
    migrate
};