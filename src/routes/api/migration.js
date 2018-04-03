"use strict";

const optionService = require('../../services/options');
const migrationService = require('../../services/migration');
const appInfo = require('../../services/app_info');

async function getMigrationInfo() {
    return {
        dbVersion: parseInt(await optionService.getOption('dbVersion')),
        app_dbVersion: appInfo.dbVersion
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