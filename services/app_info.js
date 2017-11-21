"use strict";

const build = require('./build');
const packageJson = require('../package');
const migration = require('./migration');

module.exports = {
    app_version: packageJson.version,
    db_version: migration.APP_DB_VERSION,
    build_date: build.build_date,
    build_revision: build.build_revision
};