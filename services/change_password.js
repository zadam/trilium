"use strict";

const sql = require('./sql');
const my_scrypt = require('./my_scrypt');
const utils = require('./utils');
const audit_category = require('./audit_category');
const crypto = require('crypto');
const aesjs = require('./aes');

async function changePassword(currentPassword, newPassword, req = null) {
    const current_password_hash = utils.toBase64(await my_scrypt.getVerificationHash(currentPassword));

    if (current_password_hash !== await sql.getOption('password_verification_hash')) {
        return {
            'success': false,
            'message': "Given current password doesn't match hash"
        };
    }

    const currentPasswordDerivedKey = await my_scrypt.getPasswordDerivedKey(currentPassword);

    const newPasswordVerificationKey = utils.toBase64(await my_scrypt.getVerificationHash(newPassword));
    const newPasswordEncryptionKey = await my_scrypt.getPasswordDerivedKey(newPassword);

    function decrypt(encryptedBase64) {
        const encryptedBytes = utils.fromBase64(encryptedBase64);

        const aes = getAes(currentPasswordDerivedKey);
        return aes.decrypt(encryptedBytes).slice(4);
    }

    function encrypt(plainText) {
        const aes = getAes(newPasswordEncryptionKey);

        const plainTextBuffer = Buffer.from(plainText, 'latin1');

        const digest = crypto.createHash('sha256').update(plainTextBuffer).digest().slice(0, 4);

        console.log("Digest:", digest);

        const encryptedBytes = aes.encrypt(Buffer.concat([digest, plainTextBuffer]));

        console.log("Encrypted", encryptedBytes);

        return utils.toBase64(encryptedBytes);
    }

    function getAes(key) {
        return new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
    }

    const encryptedDataKey = await sql.getOption('encrypted_data_key');

    const decryptedDataKey = decrypt(encryptedDataKey);

    const newEncryptedDataKey = encrypt(decryptedDataKey);

    await sql.doInTransaction(async () => {
        await sql.setOption('encrypted_data_key', newEncryptedDataKey);

        await sql.setOption('password_verification_hash', newPasswordVerificationKey);

        await sql.addAudit(audit_category.CHANGE_PASSWORD, req);
    });

    return {
        'success': true,
        'new_encrypted_data_key': newEncryptedDataKey
    };
}

module.exports = {
    changePassword
};