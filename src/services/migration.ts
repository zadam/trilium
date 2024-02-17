import backupService = require('./backup');
import sql = require('./sql');
import fs = require('fs-extra');
import log = require('./log');
import utils = require('./utils');
import resourceDir = require('./resource_dir');
import appInfo = require('./app_info');
import cls = require('./cls');

interface MigrationInfo {
    dbVersion: number;
    name: string;
    file: string;
    type: string;
}

async function migrate() {
    const currentDbVersion = getDbVersion();

    if (currentDbVersion < 214) {
        log.error("Direct migration from your current version is not supported. Please upgrade to the latest v0.60.4 first and only then to this version.");

        utils.crash();
        return;
    }

    // backup before attempting migration
    await backupService.backupNow(
        // creating a special backup for version 0.60.4, the changes in 0.61 are major.
        currentDbVersion === 214
            ? `before-migration-v060`
            : 'before-migration'
    );

    const migrationFiles = fs.readdirSync(resourceDir.MIGRATIONS_DIR);
    if (migrationFiles == null) {
        return;
    }

    const migrations = migrationFiles.map(file => {
        const match = file.match(/^([0-9]{4})__([a-zA-Z0-9_ ]+)\.(sql|js)$/);
        if (!match) {
            return null;
        }

        const dbVersion = parseInt(match[1]);
        if (dbVersion > currentDbVersion) {
            const name = match[2];
            const type = match[3];

            return {
                dbVersion: dbVersion,
                name: name,
                file: file,
                type: type
            };
        } else {
            return null;
        }
    }).filter((el): el is MigrationInfo => !!el);

    migrations.sort((a, b) => a.dbVersion - b.dbVersion);

    // all migrations are executed in one transaction - upgrade either succeeds, or the user can stay at the old version
    // otherwise if half of the migrations succeed, user can't use any version - DB is too "new" for the old app,
    // and too old for the new app version.

    cls.setMigrationRunning(true);

    sql.transactional(() => {
        for (const mig of migrations) {
            try {
                log.info(`Attempting migration to version ${mig.dbVersion}`);

                executeMigration(mig);

                sql.execute(`UPDATE options
                             SET value = ?
                             WHERE name = ?`, [mig.dbVersion.toString(), "dbVersion"]);

                log.info(`Migration to version ${mig.dbVersion} has been successful.`);
            } catch (e: any) {
                log.error(`error during migration to version ${mig.dbVersion}: ${e.stack}`);
                log.error("migration failed, crashing hard"); // this is not very user-friendly :-/

                utils.crash();
                break; // crash() above does not seem to work right away
            }
        }
    });

    if (currentDbVersion === 214) {
        // special VACUUM after the big migration
        log.info("VACUUMing database, this might take a while ...");
        sql.execute("VACUUM");
    }
}

function executeMigration(mig: MigrationInfo) {
    if (mig.type === 'sql') {
        const migrationSql = fs.readFileSync(`${resourceDir.MIGRATIONS_DIR}/${mig.file}`).toString('utf8');

        console.log(`Migration with SQL script: ${migrationSql}`);

        sql.executeScript(migrationSql);
    } else if (mig.type === 'js') {
        console.log("Migration with JS module");

        const migrationModule = require(`${resourceDir.MIGRATIONS_DIR}/${mig.file}`);
        migrationModule();
    } else {
        throw new Error(`Unknown migration type '${mig.type}'`);
    }
}

function getDbVersion() {
    return parseInt(sql.getValue("SELECT value FROM options WHERE name = 'dbVersion'"));
}

function isDbUpToDate() {
    const dbVersion = getDbVersion();

    const upToDate = dbVersion >= appInfo.dbVersion;

    if (!upToDate) {
        log.info(`App db version is ${appInfo.dbVersion}, while db version is ${dbVersion}. Migration needed.`);
    }

    return upToDate;
}

async function migrateIfNecessary() {
    const currentDbVersion = getDbVersion();

    if (currentDbVersion > appInfo.dbVersion && process.env.TRILIUM_IGNORE_DB_VERSION !== 'true') {
        log.error(`Current DB version ${currentDbVersion} is newer than the current DB version ${appInfo.dbVersion}, which means that it was created by a newer and incompatible version of Trilium. Upgrade to the latest version of Trilium to resolve this issue.`);

        utils.crash();
    }

    if (!isDbUpToDate()) {
        await migrate();
    }
}

export = {
    migrateIfNecessary,
    isDbUpToDate
};
