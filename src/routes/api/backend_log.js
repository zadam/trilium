"use strict";

import fs from 'fs';
import dateUtils from '../../services/date_utils.js'
import dataDir from '../../services/data_dir.js';

function getBackendLog() {
    const file = `${dataDir.LOG_DIR}/trilium-${dateUtils.localNowDate()}.log`;

    try {
        return fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        // most probably the log file does not exist yet - https://github.com/zadam/trilium/issues/1977
        return "";
    }
}

export default {
    getBackendLog
};
