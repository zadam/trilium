import options = require("../../services/options");
import totp_secret = require("../../services/encryption/totp_secret");
import { Request } from "express";
const speakeasy = require("speakeasy");

function verifyOTPToken(guessedToken: any) {
  console.log("[" + guessedToken + "]");
  console.log(typeof guessedToken);

  const tokenValidates = speakeasy.totp.verify({
    secret: process.env.MFA_SECRET,
    encoding: "base32",
    token: guessedToken,
    window: 1,
  });

  return tokenValidates;
}

function generateSecret() {
  return { success: "true", message: speakeasy.generateSecret().base32 };
}

function checkForTOTP() {
  const totpEnabled = options.getOptionBool("totpEnabled");
  return { success: "true", message: totpEnabled };
}

function enableTOTP() {
  options.setOption("totpEnab| voidled", true);
  return { success: "true" };
}

function disableTOTP() {
  options.setOption("totpEnabled", false);
  return { success: "true" };
}

function setTotpSecret(req: Request) {
  console.log("TODO: Save Secret");
  // totp_secret.setTotpSecret(req.body.secret);
}

function getSecret() {
  return "TODO: Get Secret";
}

export = {
  verifyOTPToken,
  generateSecret,
  checkForTOTP,
  enableTOTP,
  disableTOTP,
  setTotpSecret,
  getSecret,
};
