"use strict";

const sqlInit = require('../services/sql_init');
const setupService = require('../services/setup');
const utils = require('../services/utils');

function setupPage(req, res) {
    if (sqlInit.isDbInitialized()) {
        if (utils.isElectron()) {
            const windowService = require('../services/window');
            windowService.createMainWindow();
            windowService.closeSetupWindow();
        }
        else {
            res.redirect('/');
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
        syncInProgress: syncInProgress
    });
}

module.exports = {
    setupPage
};
