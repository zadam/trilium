"use strict";

const options = require('../../services/options');
const sql = require('../../services/sql');
const utils = require('../../services/utils');
const my_scrypt = require('../../services/my_scrypt');
const password_encryption = require('../../services/password_encryption');

async function setup(req) {
    const { username, password } = req.body;

    await options.setOption('username', username);

    await options.setOption('password_verification_salt', utils.randomSecureToken(32));
    await options.setOption('password_derived_key_salt', utils.randomSecureToken(32));

    const passwordVerificationKey = utils.toBase64(await my_scrypt.getVerificationHash(password));
    await options.setOption('password_verification_hash', passwordVerificationKey);

    await password_encryption.setDataKey(password, utils.randomSecureToken(16));

    sql.setDbReadyAsResolved();
}

module.exports = {
    setup
};