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
const path = require('path');

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
        if (!fs.existsSync(process.env.TRILIUM_DATA_DIR)) {
            fs.mkdirSync(process.env.TRILIUM_DATA_DIR, 0o700);
        }

        return process.env.TRILIUM_DATA_DIR;
    }

    const homePath = os.homedir() + path.sep + DIR_NAME;

    if (fs.existsSync(homePath)) {
        return homePath;
    }

    const appDataPath = getAppDataDir() + path.sep + DIR_NAME;

    if (!fs.existsSync(appDataPath)) {
        fs.mkdirSync(appDataPath, 0o700);
    }

    return appDataPath;
}

const TRILIUM_DATA_DIR =  getTriliumDataDir();
const DOCUMENT_PATH = TRILIUM_DATA_DIR + path.sep + "document.db";
const BACKUP_DIR = TRILIUM_DATA_DIR + path.sep + "backup";
const LOG_DIR = TRILIUM_DATA_DIR + path.sep + "log";
const ANONYMIZED_DB_DIR = TRILIUM_DATA_DIR + path.sep + "anonymized-db";
const CONFIG_INI_PATH = TRILIUM_DATA_DIR + '/config.ini';

module.exports = {
    TRILIUM_DATA_DIR,
    DOCUMENT_PATH,
    BACKUP_DIR,
    LOG_DIR,
    ANONYMIZED_DB_DIR,
    CONFIG_INI_PATH
};
