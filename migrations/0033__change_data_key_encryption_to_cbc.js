const password_encryption = require('../services/password_encryption');
const readline = require('readline');

const cl = readline.createInterface(process.stdin, process.stdout);

function question(q) {
    return new Promise( (res, rej) => {
        cl.question( q, answer => {
            res(answer);
        })
    });
}

module.exports = async () => {
    const password = await question("Enter password: ");
    let dataKey = await password_encryption.getDecryptedDataKey(password);

    console.log("Original data key: ", dataKey);

    dataKey = dataKey.slice(0, 16);

    console.log("Trimmed data key: ", dataKey);

    await password_encryption.setDataKey(password, dataKey);
};