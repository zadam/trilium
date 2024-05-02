import optionService = require("../options");
import myScryptService = require("./my_scrypt");
import utils = require("../utils");
import dataEncryptionService = require("./data_encryption");

// function verifyPassword(password: string) {
//   const givenPasswordHash = utils.toBase64(
//     myScryptService.getVerificationHash(password)
//   );

//   const dbPasswordHash = optionService.getOptionOrNull(
//     "passwordVerificationHash"
//   );

//   if (!dbPasswordHash) {
//     return false;
//   }

//   return givenPasswordHash === dbPasswordHash;
// }

function setDataKey(secret: string, plainTextDataKey: string | Buffer) {
  const totpSecretDerivedKey = myScryptService.getTotpSecretDerivedKey(secret);

  const newEncryptedDataKey = dataEncryptionService.encrypt(
    totpSecretDerivedKey,
    plainTextDataKey
  );

  optionService.setOption("encryptedTotpSecretDataKey", newEncryptedDataKey);
}

function getDataKey(secret: string) {
  const totpSecretDerivedKey = myScryptService.getTotpSecretDerivedKey(secret);

  const encryptedDataKey = optionService.getOption(
    "encryptedTotpSecretDataKey"
  );

  const decryptedDataKey = dataEncryptionService.decrypt(
    totpSecretDerivedKey,
    encryptedDataKey
  );

  return decryptedDataKey;
}

export = {
  //   verifyPassword,
  getDataKey,
  setDataKey,
};
