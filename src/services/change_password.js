"use strict";

const sql = require('./sql');
const optionService = require('./options');
const myScryptService = require('./my_scrypt');
const utils = require('./utils');
const passwordEncryptionService = require('./password_encryption');

function changePassword(currentPassword, newPassword) {
    if (!passwordEncryptionService.verifyPassword(currentPassword)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const newPasswordVerificationKey = utils.toBase64(myScryptService.getVerificationHash(newPassword));
    const decryptedDataKey = passwordEncryptionService.getDataKey(currentPassword);

    sql.transactional(() => {
        passwordEncryptionService.setDataKey(newPassword, decryptedDataKey);

        optionService.setOption('passwordVerificationHash', newPasswordVerificationKey);
    });

    return {
        success: true
    };
}

module.exports = {
    changePassword
};
