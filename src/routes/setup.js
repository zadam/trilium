import sqlInit from '../services/sql_init.js'
import setupService from '../services/setup.js'
import utils from '../services/utils.js'
import assetPath from '../services/asset_path.js'
import appPath from '../services/app_path.js'

import windowService from '../services/window.js'

import {app} from "electron";

function setupPage(req, res) {
    if (sqlInit.isDbInitialized()) {
        if (utils.isElectron()) {
            windowService.createMainWindow(app);
            windowService.closeSetupWindow();
        }
        else {
            res.redirect('.');
        }

        return;
    }

    // we got here because DB is not completely initialized, so if schema exists,
    // it means we're in "sync in progress" state.
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

export default {
    setupPage
};
