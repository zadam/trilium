const log = require('./log');
const path = require('path');
const fs = require('fs');

const RESOURCE_DIR = path.resolve(__dirname, "../..");

// where "trilium" executable is
const ELECTRON_APP_ROOT_DIR = path.resolve(RESOURCE_DIR, "../..");
const DB_INIT_DIR = path.resolve(RESOURCE_DIR, "db");

if (!fs.existsSync(DB_INIT_DIR)) {
    log.error(`Could not find DB initialization directory: ${DB_INIT_DIR}`);
    process.exit(1);
}

const MIGRATIONS_DIR = path.resolve(DB_INIT_DIR, "migrations");

if (!fs.existsSync(MIGRATIONS_DIR)) {
    log.error(`Could not find migration directory: ${MIGRATIONS_DIR}`);
    process.exit(1);
}

module.exports = {
    RESOURCE_DIR,
    MIGRATIONS_DIR,
    DB_INIT_DIR,
    ELECTRON_APP_ROOT_DIR
};