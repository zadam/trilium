'use strict';

const {app, globalShortcut} = require('electron');
const log = require('./src/services/log');
const sqlInit = require('./src/services/sql_init');
const cls = require('./src/services/cls');
const keyboardActionsService = require('./src/services/keyboard_actions');
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

async function registerGlobalShortcuts() {
    await sqlInit.dbReady;

    const allActions = await keyboardActionsService.getKeyboardActions();

    for (const action of allActions) {
        if (!action.effectiveShortcuts) {
            continue;
        }

        for (const shortcut of action.effectiveShortcuts) {
            if (shortcut.startsWith('global:')) {
                const translatedShortcut = shortcut.substr(7);

                const result = globalShortcut.register(translatedShortcut, cls.wrap(async () => {
                    // window may be hidden / not in focus
                    mainWindow.focus();

                    mainWindow.webContents.send('globalShortcut', action.actionName);
                }));

                if (result) {
                    log.info(`Registered global shortcut ${translatedShortcut} for action ${action.actionName}`);
                }
                else {
                    log.info(`Could not register global shortcut ${translatedShortcut}`);
                }
            }
        }
    }
}

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

    await registerGlobalShortcuts();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

require('./src/www');
