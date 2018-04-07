"use strict";

const sql = require('./sql');
const optionService = require('./options');
const myScryptService = require('./my_scrypt');
const utils = require('./utils');
const passwordEncryptionService = require('./password_encryption');

async function changePassword(currentPassword, newPassword) {
    if (!await passwordEncryptionService.verifyPassword(currentPassword)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const newPasswordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(newPassword));
    const decryptedDataKey = await passwordEncryptionService.getDataKey(currentPassword);

    await sql.transactional(async () => {
        await passwordEncryptionService.setDataKey(newPassword, decryptedDataKey);

        await optionService.setOption('passwordVerificationHash', newPasswordVerificationKey);
    });

    return {
        success: true
    };
}

module.exports = {
    changePassword
};