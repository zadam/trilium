"use strict";

const fs = require('fs');
const dataDir = require('./data_dir');

if (!fs.existsSync(dataDir.LOG_DIR)) {
    fs.mkdirSync(dataDir.LOG_DIR, 0o700);
}

const logger = require('simple-node-logger').createRollingFileLogger({
    errorEventName: 'error',
    logDirectory: dataDir.LOG_DIR,
    fileNamePattern: 'trilium-<DATE>.log',
    dateFormat:'YYYY-MM-DD'
});

function info(message) {
    // info messages are logged asynchronously
    setTimeout(() => {
        console.log(message);

        logger.info(message);
    }, 0);
}

function error(message) {
    message = "ERROR: " + message;

    // we're using .info() instead of .error() because simple-node-logger emits weird error for showError()
    // errors are logged synchronously to make sure it doesn't get lost in case of crash
    logger.info(message);

    console.trace(message);
}

const requestBlacklist = [ "/libraries", "/javascripts", "/images", "/stylesheets" ];

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