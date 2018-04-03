"use strict";

const optionService = require('../../services/options');
const sqlInit = require('../../services/sql_init');
const utils = require('../../services/utils');
const myScryptService = require('../../services/my_scrypt');
const passwordEncryptionService = require('../../services/password_encryption');

async function setup(req) {
    const { username, password } = req.body;

    await optionService.setOption('username', username);

    await optionService.setOption('passwordVerificationSalt', utils.randomSecureToken(32));
    await optionService.setOption('passwordDerivedKeySalt', utils.randomSecureToken(32));

    const passwordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(password));
    await optionService.setOption('passwordVerificationHash', passwordVerificationKey);

    await passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16));

    sqlInit.setDbReadyAsResolved();
}

module.exports = {
    setup
};