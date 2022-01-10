"use strict";

const passwordService = require('../../services/password');

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
        return [400, "Incorrect password reset confirmation"];
    }

    return passwordService.resetPassword();
}

module.exports = {
    changePassword,
    resetPassword
};
