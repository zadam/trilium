"use strict";

const sql = require('./sql');
const options = require('./options');
const my_scrypt = require('./my_scrypt');
const utils = require('./utils');
const password_encryption = require('./password_encryption');

async function changePassword(currentPassword, newPassword) {
    if (!await password_encryption.verifyPassword(currentPassword)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const newPasswordVerificationKey = utils.toBase64(await my_scrypt.getVerificationHash(newPassword));
    const decryptedDataKey = await password_encryption.getDataKey(currentPassword);

    await sql.doInTransaction(async () => {
        await password_encryption.setDataKey(newPassword, decryptedDataKey);

        await options.setOption('password_verification_hash', newPasswordVerificationKey);
    });

    return {
        success: true
    };
}

module.exports = {
    changePassword
};