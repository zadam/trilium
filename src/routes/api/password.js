"use strict";

const passwordService = require('../../services/encryption/password.js');
const ValidationError = require('../../errors/validation_error.js');

function changePassword(req) {
    if (passwordService.isPasswordSet()) {
        return passwordService.changePassword(req.body.current_password, req.body.new_password);
    }
    else {
        return passwordService.setPassword(req.body.new_password);
    }
}

function resetPassword(req) {
    // protection against accidental call (not a security measure)
    if (req.query.really !== "yesIReallyWantToResetPasswordAndLoseAccessToMyProtectedNotes") {
        throw new ValidationError("Incorrect password reset confirmation");
    }

    return passwordService.resetPassword();
}

module.exports = {
    changePassword,
    resetPassword
};
