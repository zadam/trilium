"use strict";

const fs = require('fs');
const crypto = require('crypto');
const dataDir = require('./data_dir.js');
const log = require('./log.js');

const sessionSecretPath = `${dataDir.TRILIUM_DATA_DIR}/session_secret.txt`;

let sessionSecret;

function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len).toUpperCase();   // return required number of characters
}

if (!fs.existsSync(sessionSecretPath)) {
    sessionSecret = randomValueHex(64);

    log.info("Generated session secret");

    fs.writeFileSync(sessionSecretPath, sessionSecret, 'ASCII');
}
else {
    sessionSecret = fs.readFileSync(sessionSecretPath, 'ASCII');
}

module.exports = sessionSecret;
