"use strict";

const options = require('../../services/options');
const migration = require('../../services/migration');
const app_info = require('../../services/app_info');

async function getMigrationInfo() {
    return {
        db_version: parseInt(await options.getOption('db_version')),
        app_db_version: app_info.db_version
    };
}

async function executeMigration() {
    const migrations = await migration.migrate();

    return {
        migrations: migrations
    };
}

module.exports = {
    getMigrationInfo,
    executeMigration
};