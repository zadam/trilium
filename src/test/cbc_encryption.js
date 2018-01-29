const test = require('tape');
const data_encryption = require('../services/data_encryption');

test('encrypt & decrypt', t => {
    const dataKey = [1,2,3];
    const iv = [4,5,6];
    const plainText = "Hello World!";

    const cipherText = data_encryption.encrypt(dataKey, iv, plainText);
    const decodedPlainText = data_encryption.decrypt(dataKey, iv, cipherText);

    t.equal(decodedPlainText, plainText);
    t.end();
});