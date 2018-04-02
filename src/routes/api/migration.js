"use strict";

const optionService = require('../../services/options');
const migrationService = require('../../services/migration');
const appInfo = require('../../services/app_info');

async function getMigrationInfo() {
    return {
        db_version: parseInt(await optionService.getOption('db_version')),
        app_db_version: appInfo.db_version
    };
}

async function executeMigration() {
    const migrations = await migrationService.migrate();

    return {
        migrations: migrations
    };
}

module.exports = {
    getMigrationInfo,
    executeMigration
};