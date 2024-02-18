"use strict";

import sql = require('../sql');
import optionService = require('../options');
import myScryptService = require('./my_scrypt');
import utils = require('../utils');
import passwordEncryptionService = require('./password_encryption');

function isPasswordSet() {
    return !!sql.getValue("SELECT value FROM options WHERE name = 'passwordVerificationHash'");
}

function changePassword(currentPassword: string, newPassword: string) {
    if (!isPasswordSet()) {
        throw new Error("Password has not been set yet, so it cannot be changed. Use 'setPassword' instead.");
    }

    if (!passwordEncryptionService.verifyPassword(currentPassword)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    sql.transactional(() => {
        const decryptedDataKey = passwordEncryptionService.getDataKey(currentPassword);

        optionService.setOption('passwordVerificationSalt', utils.randomSecureToken(32));
        optionService.setOption('passwordDerivedKeySalt', utils.randomSecureToken(32));

        const newPasswordVerificationKey = utils.toBase64(myScryptService.getVerificationHash(newPassword));
        
        if (decryptedDataKey) {
            // TODO: what should happen if the decrypted data key is null?
            passwordEncryptionService.setDataKey(newPassword, decryptedDataKey);
        }

        optionService.setOption('passwordVerificationHash', newPasswordVerificationKey);
    });

    return {
        success: true
    };
}

function setPassword(password: string) {
    if (isPasswordSet()) {
        throw new Error("Password is set already. Either change it or perform 'reset password' first.");
    }

    optionService.createOption('passwordVerificationSalt', utils.randomSecureToken(32), true);
    optionService.createOption('passwordDerivedKeySalt', utils.randomSecureToken(32), true);

    const passwordVerificationKey = utils.toBase64(myScryptService.getVerificationHash(password));
    optionService.createOption('passwordVerificationHash', passwordVerificationKey, true);

    // passwordEncryptionService expects these options to already exist
    optionService.createOption('encryptedDataKey', '', true);

    passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16));

    return {
        success: true
    };
}

function resetPassword() {
    // user forgot the password,
    sql.transactional(() => {
        optionService.setOption('passwordVerificationSalt', '');
        optionService.setOption('passwordDerivedKeySalt', '');
        optionService.setOption('encryptedDataKey', '');
        optionService.setOption('passwordVerificationHash', '');
    });

    return {
        success: true
    };
}

export = {
    isPasswordSet,
    changePassword,
    setPassword,
    resetPassword
};
