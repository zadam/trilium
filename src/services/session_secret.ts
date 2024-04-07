"use strict";

import fs = require('fs');
import crypto = require('crypto');
import dataDir = require('./data_dir');
import log = require('./log');

const sessionSecretPath = `${dataDir.TRILIUM_DATA_DIR}/session_secret.txt`;

let sessionSecret: string;

const ENCODING = "ascii";

function randomValueHex(len: number) {
    return crypto.randomBytes(Math.ceil(len / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len).toUpperCase();   // return required number of characters
}

if (!fs.existsSync(sessionSecretPath)) {
    sessionSecret = randomValueHex(64);

    log.info("Generated session secret");

    fs.writeFileSync(sessionSecretPath, sessionSecret, ENCODING);
}
else {
    sessionSecret = fs.readFileSync(sessionSecretPath, ENCODING);
}

export = sessionSecret;
