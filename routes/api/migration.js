const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const backup = require('../../services/backup');
const sql = require('../../services/sql');
const fs = require('fs-extra');

const APP_DB_VERSION = 0;
const MIGRATIONS_DIR = "../trilium-data/migrations";

router.get('', auth.checkApiAuth, async (req, res, next) => {
    res.send({
        'db_version': parseInt(await sql.getOption('db_version')),
        'app_db_version': APP_DB_VERSION
    });
});

router.post('', auth.checkApiAuth, async (req, res, next) => {
    const migrations = [];

    await backup.backupNow();

    const currentDbVersion = parseInt(await sql.getOption('db_version'));

    fs.readdirSync(MIGRATIONS_DIR).forEach(file => {
        const match = file.match(/([0-9]{4})__([a-zA-Z0-9_ ]+)\.sql/);

        if (match) {
            const dbVersion = parseInt(match.group(1));

            if (dbVersion > currentDbVersion) {
                const name = match.group(2);

                const migrationRecord = {
                    'db_version': dbVersion,
                    'name': name,
                    'file': file
                };

                migrations.push(migrationRecord);
            }
        }
    });

    migrations.sort((a, b) => a.db_version - b.db_version);

    for (const mig of migrations) {
        const migrationSql = fs.readFileSync(MIGRATIONS_DIR + "/" + mig.file);

        try {
            await sql.beginTransaction();

            await sql.executeScript(migrationSql);

            await sql.commit();

            mig['success'] = true;
        }
        catch (e) {
            mig['success'] = false;
            mig['error'] = e.stack;

            break;
        }
    }

    res.send({
        'migrations': migrations
    });
});

module.exports = router;