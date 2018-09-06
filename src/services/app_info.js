"use strict";

const build = require('./build');
const packageJson = require('../../package');

const APP_DB_VERSION = 113;
const SYNC_VERSION = 1;

module.exports = {
    appVersion: packageJson.version,
    dbVersion: APP_DB_VERSION,
    syncVersion: SYNC_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision
};