'use strict';

import { app, globalShortcut, BrowserWindow } from 'electron';
import sqlInit from './src/services/sql_init.js';
import appIconService from './src/services/app_icon.js';
import windowService from './src/services/window.js';
import tray from './src/services/tray.js';
import electron_debug from "electron-debug";
import electron_dl from "electron-dl";

import './src/www.js';

// Adds debug features like hotkeys for triggering dev tools and reload
electron_debug();

appIconService.installLocalAppIcon();

electron_dl({ saveAs: true });

// needed for excalidraw export https://github.com/zadam/trilium/issues/4271
app.commandLine.appendSwitch("enable-experimental-web-platform-features");

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
