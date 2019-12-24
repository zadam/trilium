'use strict';

const {app, globalShortcut, BrowserWindow} = require('electron');
const path = require('path');
const log = require('./src/services/log');
const sqlInit = require('./src/services/sql_init');
const cls = require('./src/services/cls');
const url = require("url");
const port = require('./src/services/port');
const optionService = require('./src/services/options');
const env = require('./src/services/env');
const keyboardActionsService = require('./src/services/keyboard_actions');
const appIconService = require('./src/services/app_icon');
const windowStateKeeper = require('electron-window-state');

// Adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

appIconService.installLocalAppIcon();

// Prevent window being garbage collected
let mainWindow;

require('electron-dl')({ saveAs: true });

function onClosed() {
    // Dereference the window
    // For multiple windows store them in an array
    mainWindow = null;
}

async function createMainWindow() {
    await sqlInit.dbConnection;

    let frame = true;

    // if schema doesn't exist -> setup process
    // if schema exists, then we need to wait until the migration process is finished
    if (await sqlInit.schemaExists()) {
        await sqlInit.dbReady;

        frame = await optionService.getOptionBool('nativeTitleBarVisible')
    }

    const mainWindowState = windowStateKeeper({
        // default window width & height so it's usable on 1600 * 900 display (including some extra panels etc.)
        defaultWidth: 1200,
        defaultHeight: 800
    });

    const win = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        title: 'Trilium Notes',
        webPreferences: {
            nodeIntegration: true
        },
        frame: frame,
        icon: path.join(__dirname, 'images/app-icons/png/256x256' + (env.isDev() ? '-dev' : '') + '.png')
    });

    mainWindowState.manage(win);

    win.setMenuBarVisibility(false);
    win.loadURL('http://127.0.0.1:' + await port);
    win.on('closed', onClosed);

    win.webContents.on('new-window', (e, url) => {
        if (url !== win.webContents.getURL()) {
            e.preventDefault();
            require('electron').shell.openExternal(url);
        }
    });

    // prevent drag & drop to navigate away from trilium
    win.webContents.on('will-navigate', (ev, targetUrl) => {
        const parsedUrl = url.parse(targetUrl);

        // we still need to allow internal redirects from setup and migration pages
        if (!['localhost', '127.0.0.1'].includes(parsedUrl.hostname) || (parsedUrl.path && parsedUrl.path !== '/')) {
            ev.preventDefault();
        }
    });

    return win;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    else if (process.platform === 'win32') {
        app.exit(0); // attempt to fix the issue when app.quite() won't terminate processes on windows
    }
});

app.on('activate', () => {
    if (!mainWindow) {
        mainWindow = createMainWindow();
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

    mainWindow = await createMainWindow();

    registerGlobalShortcuts();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

require('./src/www');
