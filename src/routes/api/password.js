"use strict";

const changePasswordService = require('../../services/change_password');

async function changePassword(req) {
    return await changePasswordService.changePassword(req.body.current_password, req.body.new_password);
}

module.exports = {
    changePassword
};