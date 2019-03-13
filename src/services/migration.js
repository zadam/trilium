const backupService = require('./backup');
const sql = require('./sql');
const sqlInit = require('./sql_init');
const optionService = require('./options');
const fs = require('fs-extra');
const log = require('./log');
const utils = require('./utils');
const resourceDir = require('./resource_dir');

async function migrate() {
    const migrations = [];

    // backup before attempting migration
    await backupService.backupNow("before-migration");

    const currentDbVersion = parseInt(await optionService.getOption('dbVersion'));

    fs.readdirSync(resourceDir.MIGRATIONS_DIR).forEach(file => {
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

            // needs to happen outside of the transaction (otherwise it's a NO-OP)
            await sql.execute("PRAGMA foreign_keys = OFF");

            await sql.transactional(async () => {
                if (mig.type === 'sql') {
                    const migrationSql = fs.readFileSync(resourceDir.MIGRATIONS_DIR + "/" + mig.file).toString('utf8');

                    console.log("Migration with SQL script: " + migrationSql);

                    await sql.executeScript(migrationSql);
                }
                else if (mig.type === 'js') {
                    console.log("Migration with JS module");

                    const migrationModule = require(resourceDir.MIGRATIONS_DIR + "/" + mig.file);
                    await migrationModule();
                }
                else {
                    throw new Error("Unknown migration type " + mig.type);
                }

                // not using repository because of changed utcDateModified column in migration 129
                await sql.execute(`UPDATE options SET value = ? WHERE name = ?`, [mig.dbVersion, "dbVersion"]);
            });

            log.info("Migration to version " + mig.dbVersion + " has been successful.");
        }
        catch (e) {
            log.error("error during migration to version " + mig.dbVersion + ": " + e.stack);
            log.error("migration failed, crashing hard"); // this is not very user friendly :-/

            utils.crash();
        }
        finally {
            // make sure foreign keys are enabled even if migration script disables them
            await sql.execute("PRAGMA foreign_keys = ON");
        }
    }

    if (await sqlInit.isDbUpToDate()) {
        await sqlInit.initDbConnection();
    }
}

module.exports = {
    migrate
};