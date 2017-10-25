const backup = require('./backup');
const sql = require('./sql');
const fs = require('fs-extra');

const APP_DB_VERSION = 9;
const MIGRATIONS_DIR = "./migrations";

async function migrate() {
    const migrations = [];

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
            console.log("Running script: ", migrationSql);

            await sql.beginTransaction();

            await sql.executeScript(migrationSql);

            await sql.setOption("db_version", mig.dbVersion);

            await sql.commit();

            mig['success'] = true;
        }
        catch (e) {
            mig['success'] = false;
            mig['error'] = e.stack;

            console.log("error during migration: ", e);

            break;
        }
    }
    return migrations;
}

module.exports = {
    migrate,
    APP_DB_VERSION
};