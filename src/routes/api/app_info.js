"use strict";

const app_info = require('../../services/app_info');

async function getAppInfo() {
    return app_info;
}

module.exports = {
    getAppInfo
};