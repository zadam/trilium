"use strict";

const build = require('./build');
const packageJson = require('../../package');
const {TRILIUM_DATA_DIR} = require('./data_dir');

const APP_DB_VERSION = 123;
const SYNC_VERSION = 4;

module.exports = {
    appVersion: packageJson.version,
    dbVersion: APP_DB_VERSION,
    syncVersion: SYNC_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision,
    dataDirectory: TRILIUM_DATA_DIR
};