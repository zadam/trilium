"use strict";

const changePasswordService = require('../../services/change_password');

function changePassword(req) {
    return changePasswordService.changePassword(req.body.current_password, req.body.new_password);
}

module.exports = {
    changePassword
};
