"use strict";

const sql = require('./sql');
const options = require('./options');
const my_scrypt = require('./my_scrypt');
const utils = require('./utils');
const audit_category = require('./audit_category');
const password_encryption = require('./password_encryption');

async function changePassword(currentPassword, newPassword, req) {
    if (!await password_encryption.verifyPassword(currentPassword)) {
        return {
            success: false,
            message: "Given current password doesn't match hash"
        };
    }

    const newPasswordVerificationKey = utils.toBase64(await my_scrypt.getVerificationHash(newPassword));
    const newPasswordDerivedKey = await my_scrypt.getPasswordDerivedKey(newPassword);

    const decryptedDataKey = await password_encryption.getDataKey(currentPassword);

    await sql.doInTransaction(async () => {
        await password_encryption.setDataKey(newPasswordDerivedKey, decryptedDataKey);

        await options.setOption('password_verification_hash', newPasswordVerificationKey);

        await sql.addAudit(audit_category.CHANGE_PASSWORD, utils.browserId(req));
    });

    return {
        success: true,
        new_encrypted_data_key: newEncryptedDataKey
    };
}

module.exports = {
    changePassword
};