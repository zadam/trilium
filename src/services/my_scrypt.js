"use strict";

const options = require('./options');
const scrypt = require('scrypt');

async function getVerificationHash(password) {
    const salt = await options.getOption('password_verification_salt');

    return getScryptHash(password, salt);
}

async function getPasswordDerivedKey(password) {
    const salt = await options.getOption('password_derived_key_salt');

    return getScryptHash(password, salt);
}

async function getScryptHash(password, salt) {
    const hashed = scrypt.hashSync(password,
        {N: 16384, r:8, p:1},
        32,
        salt);

    return hashed;
}

module.exports = {
    getVerificationHash,
    getPasswordDerivedKey
};