'use strict';

const {app, globalShortcut, BrowserWindow} = require('electron');
const sqlInit = require('./src/services/sql_init');
const appIconService = require('./src/services/app_icon');
const windowService = require('./src/services/window');
const tray = require('./src/services/tray');

// Adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

appIconService.installLocalAppIcon();

require('electron-dl')({ saveAs: true });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('ready', async () => {
//    app.setAppUserModelId('com.github.zadam.trilium');

    // if db is not initialized -> setup process
    // if db is initialized, then we need to wait until the migration process is finished
    if (sqlInit.isDbInitialized()) {
        await sqlInit.dbReady;

        await windowService.createMainWindow(app);

        if (process.platform === 'darwin') {
            app.on('activate', async () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    await windowService.createMainWindow(app);
                }
            });
        }

        tray.createTray();
    }
    else {
        await windowService.createSetupWindow();
    }

    await windowService.registerGlobalShortcuts();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// this is to disable electron warning spam in the dev console (local development only)
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

require('./src/www');
