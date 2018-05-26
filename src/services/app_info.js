"use strict";

const build = require('./build');
const packageJson = require('../../package');

const APP_DB_VERSION = 94;

module.exports = {
    appVersion: packageJson.version,
    dbVersion: APP_DB_VERSION,
    buildDate: build.buildDate,
    buildRevision: build.buildRevision
};