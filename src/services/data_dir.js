"use strict";

const os = require('os');
const fs = require('fs');

const TRILIUM_DATA_DIR = process.env.TRILIUM_DATA_DIR || os.homedir() + "/trilium-data";

if (!fs.existsSync(TRILIUM_DATA_DIR)) {
    fs.mkdirSync(TRILIUM_DATA_DIR, 0o700);
}

const DOCUMENT_PATH = TRILIUM_DATA_DIR + "/document.db";
const BACKUP_DIR = TRILIUM_DATA_DIR + "/backup";
const LOG_DIR = TRILIUM_DATA_DIR + "/log";
const EXPORT_DIR = TRILIUM_DATA_DIR + "/export";
const ANONYMIZED_DB_DIR = TRILIUM_DATA_DIR + "/anonymized-db";

module.exports = {
    TRILIUM_DATA_DIR,
    DOCUMENT_PATH,
    BACKUP_DIR,
    LOG_DIR,
    ANONYMIZED_DB_DIR
};