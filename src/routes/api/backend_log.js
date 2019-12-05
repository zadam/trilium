"use strict";

const fs = require('fs');
const dateUtils = require('../../services/date_utils');
const {LOG_DIR} = require('../../services/data_dir.js');

async function getBackendLog() {
    const file = `${LOG_DIR}/trilium-${dateUtils.localNowDate()}.log`;

    return fs.readFileSync(file, 'utf8');
}

module.exports = {
    getBackendLog
};