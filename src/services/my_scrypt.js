"use strict";

const optionService = require('./options');
const scrypt = require('scrypt');

async function getVerificationHash(password) {
    const salt = await optionService.getOption('passwordVerificationSalt');

    return getScryptHash(password, salt);
}

async function getPasswordDerivedKey(password) {
    const salt = await optionService.getOption('passwordDerivedKeySalt');

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