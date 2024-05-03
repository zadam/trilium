"use strict";

import fs = require('fs');
import crypto = require('crypto');
import dataDir = require('./data_dir');
import log = require('./log');

const totpSecretPath = `${dataDir.TRILIUM_DATA_DIR}/totp_secret.txt`;

function saveTotpSecret(secret: string)
{
    if (!fs.existsSync(totpSecretPath)) 
        log.info("Generated totp secret file");

    fs.writeFileSync(totpSecretPath, secret, "utf8");
}

function getTotpSecret(){

    return fs.readFileSync(totpSecretPath, "utf8");
}

function checkForTotSecret() {
    return fs.existsSync(totpSecretPath)
}

function removeTotpSecret() {
    console.log("Attempting to remove secret")
    fs.unlink( totpSecretPath, a => {
        console.log("Unable to remove totp secret")
        console.log(a)
        return false
    })
    return true
}

export = {saveTotpSecret, getTotpSecret, checkForTotSecret, removeTotpSecret};
