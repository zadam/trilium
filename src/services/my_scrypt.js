"use strict";

const optionService = require('./options');
const crypto = require('crypto');

async function getVerificationHash(password) {
    const salt = await optionService.getOption('passwordVerificationSalt');

    return getScryptHash(password, salt);
}

async function getPasswordDerivedKey(password) {
    const salt = await optionService.getOption('passwordDerivedKeySalt');

    return getScryptHash(password, salt);
}

async function getScryptHash(password, salt) {
    const hashed = crypto.scryptSync(password, salt, 32,
        {N: 16384, r:8, p:1});

    return hashed;
}

module.exports = {
    getVerificationHash,
    getPasswordDerivedKey
};