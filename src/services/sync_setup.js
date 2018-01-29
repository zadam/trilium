"use strict";

const config = require('./config');

module.exports = {
    SYNC_SERVER: config['Sync']['syncServerHost'],
    isSyncSetup: !!config['Sync']['syncServerHost'],
    SYNC_TIMEOUT: config['Sync']['syncServerTimeout'] || 5000,
    SYNC_PROXY: config['Sync']['syncProxy'],
    SYNC_CERT_PATH: config['Sync']['syncServerCertificate']
};