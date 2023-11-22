"use strict";

const optionService = require('../options.js');
const crypto = require('crypto');

function getVerificationHash(password) {
    const salt = optionService.getOption('passwordVerificationSalt');

    return getScryptHash(password, salt);
}

function getPasswordDerivedKey(password) {
    const salt = optionService.getOption('passwordDerivedKeySalt');

    return getScryptHash(password, salt);
}

function getScryptHash(password, salt) {
    const hashed = crypto.scryptSync(password, salt, 32,
        {N: 16384, r:8, p:1});

    return hashed;
}

module.exports = {
    getVerificationHash,
    getPasswordDerivedKey
};
