"use strict";

const appInfo = require('../../services/app_info.js');

function getAppInfo() {
    return appInfo;
}

module.exports = {
    getAppInfo
};
