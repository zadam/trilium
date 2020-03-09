"use strict";

const appInfo = require('../../services/app_info');

async function getAppInfo() {
    return appInfo;
}

module.exports = {
    getAppInfo
};