"use strict";

import sql = require("../sql");
import optionService = require("../options");
import myScryptService = require("./my_scrypt");
import utils = require("../utils");
import totpEncryptionService = require("./totp_secret_encryption");

function isTotpSecretSet() {
  return !!sql.getValue(
    "SELECT value FROM options WHERE name = 'passwordVerificationHash'"
  );
}

function changePassword(currentSecret: string, newSecret: string) {
  if (!isTotpSecretSet()) {
    throw new Error(
      "TOTP Secret has not been set yet, so it cannot be changed. Use 'setTotpSecret' instead."
    );
  }

  sql.transactional(() => {
    const decryptedDataKey = totpEncryptionService.getDataKey(currentSecret);

    optionService.setOption(
      "totpSecretVerificationSalt",
      utils.randomSecureToken(32)
    );
    optionService.setOption(
      "totpSecretDerivedKeySalt",
      utils.randomSecureToken(32)
    );

    const newTotpSecretVerificationKey = utils.toBase64(
      myScryptService.getTotpSecretVerificationHash(newSecret)
    );

    if (decryptedDataKey) {
      // TODO: what should happen if the decrypted data key is null?
      totpEncryptionService.setDataKey(newSecret, decryptedDataKey);
    }

    optionService.setOption(
      "totpSecretVerificationHash",
      newTotpSecretVerificationKey
    );
  });

  return {
    success: true,
  };
}

function setTotpSecret(secret: string) {
  if (isTotpSecretSet()) {
    throw new Error(
      "TOTP Secret is set already. Either change it or perform 'reset TOTP' first."
    );
  }

  optionService.createOption(
    "totpSecretVerificationSalt",
    utils.randomSecureToken(32),
    true
  );
  optionService.createOption(
    "totpSecretDerivedKeySalt",
    utils.randomSecureToken(32),
    true
  );

  const totpSecretVerificationKey = utils.toBase64(
    myScryptService.getTotpSecretVerificationHash(secret)
  );
  optionService.createOption(
    "totpSecretVerificationHash",
    totpSecretVerificationKey,
    true
  );

  // totpEncryptionService expects these options to already exist
  optionService.createOption("encryptedTotpSecretDataKey", "", true);

  totpEncryptionService.setDataKey(secret, utils.randomSecureToken(16));

  return {
    success: true,
  };
}

function resetPassword() {
  // user forgot the password,
  sql.transactional(() => {
    optionService.setOption("passwordVerificationSalt", "");
    optionService.setOption("passwordDerivedKeySalt", "");
    optionService.setOption("encryptedDataKey", "");
    optionService.setOption("passwordVerificationHash", "");
  });

  return {
    success: true,
  };
}

export = {
  isTotpSecretSet,
  changePassword,
  setTotpSecret,
  resetPassword,
};
