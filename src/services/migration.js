const backupService = require('./backup');
const sql = require('./sql');
const fs = require('fs-extra');
const log = require('./log');
const utils = require('./utils');
const resourceDir = require('./resource_dir');
const appInfo = require('./app_info');

function executeMigration(mig) {
    sql.transactional(() => {
        if (mig.type === 'sql') {
            const migrationSql = fs.readFileSync(resourceDir.MIGRATIONS_DIR + "/" + mig.file).toString('utf8');

            console.log("Migration with SQL script: " + migrationSql);

            sql.executeScript(migrationSql);
        } else if (mig.type === 'js') {
            console.log("Migration with JS module");

            const migrationModule = require(resourceDir.MIGRATIONS_DIR + "/" + mig.file);
            migrationModule();
        } else {
            throw new Error("Unknown migration type " + mig.type);
        }
    });
}

async function migrate() {
    const migrations = [];

    // backup before attempting migration
    await backupService.backupNow("before-migration");

    const currentDbVersion = getDbVersion();

    if (currentDbVersion < 183) {
        log.error("Direct migration from your current version is not supported. Please upgrade to the latest v0.47.X first and only then to this version.");

        utils.crash();
        return;
    }

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

            executeMigration(mig);

            sql.execute(`UPDATE options SET value = ? WHERE name = ?`, [mig.dbVersion.toString(), "dbVersion"]);

            log.info("Migration to version " + mig.dbVersion + " has been successful.");
        }
        catch (e) {
            log.error("error during migration to version " + mig.dbVersion + ": " + e.stack);
            log.error("migration failed, crashing hard"); // this is not very user friendly :-/

            utils.crash();
        }
    }
}

function getDbVersion() {
    return parseInt(sql.getValue("SELECT value FROM options WHERE name = 'dbVersion'"));
}

function isDbUpToDate() {
    const dbVersion = getDbVersion();

    const upToDate = dbVersion >= appInfo.dbVersion;

    if (!upToDate) {
        log.info("App db version is " + appInfo.dbVersion + ", while db version is " + dbVersion + ". Migration needed.");
    }

    return upToDate;
}

async function migrateIfNecessary() {
    const currentDbVersion = getDbVersion();

    if (currentDbVersion > appInfo.dbVersion && process.env.TRILIUM_IGNORE_DB_VERSION !== 'true') {
        log.error(`Current DB version ${currentDbVersion} is newer than app db version ${appInfo.dbVersion} which means that it was created by newer and incompatible version of Trilium. Upgrade to latest version of Trilium to resolve this issue.`);

        utils.crash();
    }

    if (!isDbUpToDate()) {
        await migrate();
    }
}

module.exports = {
    migrateIfNecessary
};
