"use strict";

const fs = require('fs');
const dateUtils = require('../../services/date_utils.js');
const {LOG_DIR} = require('../../services/data_dir.js');

function getBackendLog() {
    const file = `${LOG_DIR}/trilium-${dateUtils.localNowDate()}.log`;

    try {
        return fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        // most probably the log file does not exist yet - https://github.com/zadam/trilium/issues/1977
        return "";
    }
}

module.exports = {
    getBackendLog
};
