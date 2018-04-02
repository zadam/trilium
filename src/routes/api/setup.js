"use strict";

const optionService = require('../../services/options');
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const myScryptService = require('../../services/my_scrypt');
const passwordEncryptionService = require('../../services/password_encryption');

async function setup(req) {
    const { username, password } = req.body;

    await optionService.setOption('username', username);

    await optionService.setOption('password_verification_salt', utils.randomSecureToken(32));
    await optionService.setOption('password_derived_key_salt', utils.randomSecureToken(32));

    const passwordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(password));
    await optionService.setOption('password_verification_hash', passwordVerificationKey);

    await passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16));

    sql.setDbReadyAsResolved();
}

module.exports = {
    setup
};