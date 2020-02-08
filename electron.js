'use strict';

const {app, globalShortcut} = require('electron');
const sqlInit = require('./src/services/sql_init');
const appIconService = require('./src/services/app_icon');
const windowService = require('./src/services/window');

// Adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

appIconService.installLocalAppIcon();

require('electron-dl')({ saveAs: true });

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    else if (process.platform === 'win32') {
        app.exit(0); // attempt to fix the issue when app.quite() won't terminate processes on windows
    }
});

app.on('ready', async () => {
    app.setAppUserModelId('com.github.zadam.trilium');

    await sqlInit.dbConnection;

    // if schema doesn't exist -> setup process
    // if schema exists, then we need to wait until the migration process is finished
    if (await sqlInit.schemaExists()) {
        await sqlInit.dbReady;

        await windowService.createMainWindow();
    }
    else {
        await windowService.createSetupWindow();
    }

    await windowService.registerGlobalShortcuts();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

require('./src/www');
