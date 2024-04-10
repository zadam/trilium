"use strict";

const appInfo = require('../../services/app_info');

function getAppInfo() {
    return appInfo;
}

module.exports = {
    getAppInfo
};
