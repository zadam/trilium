"use strict";

const sqlInit = require('../services/sql_init');
const setupService = require('../services/setup');
const utils = require('../services/utils');
const assetPath = require("../services/asset_path");
const appPath = require("../services/app_path");

function setupPage(req, res) {
    if (sqlInit.isDbInitialized()) {
        if (utils.isElectron()) {
            const windowService = require('../services/window');
            const {app} = require('electron');
            windowService.createMainWindow(app);
            windowService.closeSetupWindow();
        }
        else {
            res.redirect('.');
        }

        return;
    }

    // we got here because DB is not completely initialized so if schema exists
    // it means we're in sync in progress state.
    const syncInProgress = sqlInit.schemaExists();

    if (syncInProgress) {
        // trigger sync if it's not already running
        setupService.triggerSync();
    }

    res.render('setup', {
        syncInProgress: syncInProgress,
        assetPath: assetPath,
        appPath: appPath
    });
}

module.exports = {
    setupPage
};
