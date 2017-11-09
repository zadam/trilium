"use strict";

const fs = require('fs');
const LOG_DIR = require('./data_dir').LOG_DIR;

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, 0o700);
}

const logger = require('simple-node-logger').createRollingFileLogger({
    errorEventName: 'error',
    logDirectory: LOG_DIR,
    fileNamePattern: 'trilium-<DATE>.log',
    dateFormat:'YYYY-MM-DD'
});

function info(message) {
    logger.info(message);

    console.log(message);
}

function error(message) {
    // we're using .info() instead of .error() because simple-node-logger emits weird error for showError()
    info(message);
}

const requestBlacklist = [ "/api/audit", "/libraries", "/javascripts", "/images", "/stylesheets" ];

function request(req) {
    for (const bl of requestBlacklist) {
        if (req.url.startsWith(bl)) {
            return;
        }
    }

    logger.info(req.method + " " + req.url);
}

module.exports = {
    info,
    error,
    request
};