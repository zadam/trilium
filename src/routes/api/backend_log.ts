"use strict";

import fs = require('fs');
import dateUtils = require('../../services/date_utils');
import dataDir = require('../../services/data_dir');
const { LOG_DIR } = dataDir;

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

export = {
    getBackendLog
};
