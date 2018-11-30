"use strict";

/*
 * This file resolves trilium data path in this order of priority:
 * - if TRILIUM_DATA_DIR environment variable exists, then its value is used as the path
 * - if "trilium-data" dir exists directly in the home dir, then it is used
 * - based on OS convention, if the "app data directory" exists, we'll use or create "trilium-data" directory there
 * - as a fallback if previous step fails, we'll use home dir
 */

const os = require('os');
const fs = require('fs');

function getAppDataDir() {
    let appDataDir = os.homedir(); // fallback if OS is not recognized

    if (os.platform() === 'win32') {
        appDataDir = process.env.APPDATA;
    }
    else if (os.platform() === 'linux') {
        appDataDir = os.homedir() + '/.local/share';
    }
    else if (os.platform() === 'darwin') {
        appDataDir = os.homedir() + '/Library/Application Support';
    }

    if (!fs.existsSync(appDataDir)) {
        // expected app data path doesn't exist, let's use fallback
        appDataDir = os.homedir();
    }

    return appDataDir;
}

const DIR_NAME = 'trilium-data';

function getTriliumDataDir() {
    if (process.env.TRILIUM_DATA_DIR) {
        return process.env.TRILIUM_DATA_DIR;
    }

    const homePath = os.homedir() + "/" + DIR_NAME;

    if (fs.existsSync(homePath)) {
        return homePath;
    }

    const appDataPath = getAppDataDir() + '/' + DIR_NAME;

    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, 0o700);
    }

    return appDataPath;
}

const TRILIUM_DATA_DIR =  getTriliumDataDir();

// not necessary to log this since if we have logs we already know where data dir is.
console.log("Using data dir:", TRILIUM_DATA_DIR);

const DOCUMENT_PATH = TRILIUM_DATA_DIR + "/document.db";
const BACKUP_DIR = TRILIUM_DATA_DIR + "/backup";
const LOG_DIR = TRILIUM_DATA_DIR + "/log";
const ANONYMIZED_DB_DIR = TRILIUM_DATA_DIR + "/anonymized-db";

module.exports = {
    TRILIUM_DATA_DIR,
    DOCUMENT_PATH,
    BACKUP_DIR,
    LOG_DIR,
    ANONYMIZED_DB_DIR
};