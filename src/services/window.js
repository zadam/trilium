const path = require('path');
const url = require("url");
const port = require('./port');
const optionService = require('./options');
const env = require('./env');

// Prevent window being garbage collected
/** @type {Electron.BrowserWindow} */
let mainWindow;
/** @type {Electron.BrowserWindow} */
let setupWindow;

async function createMainWindow() {
    const windowStateKeeper = require('electron-window-state'); // should not be statically imported

    const mainWindowState = windowStateKeeper({
        // default window width & height so it's usable on 1600 * 900 display (including some extra panels etc.)
        defaultWidth: 1200,
        defaultHeight: 800
    });

    const {BrowserWindow} = require('electron'); // should not be statically imported
    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        title: 'Trilium Notes',
        webPreferences: {
            nodeIntegration: true
        },
        frame: await optionService.getOptionBool('nativeTitleBarVisible'),
        icon: getIcon()
    });

    mainWindowState.manage(mainWindow);

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL('http://127.0.0.1:' + await port);
    mainWindow.on('closed', () => mainWindow = null);

    mainWindow.webContents.on('new-window', (e, url) => {
        if (url !== mainWindow.webContents.getURL()) {
            e.preventDefault();
            require('electron').shell.openExternal(url);
        }
    });

    // prevent drag & drop to navigate away from trilium
    mainWindow.webContents.on('will-navigate', (ev, targetUrl) => {
        const parsedUrl = url.parse(targetUrl);

        // we still need to allow internal redirects from setup and migration pages
        if (!['localhost', '127.0.0.1'].includes(parsedUrl.hostname) || (parsedUrl.path && parsedUrl.path !== '/')) {
            ev.preventDefault();
        }
    });
}

function getIcon() {
    return path.join(__dirname, 'images/app-icons/png/256x256' + (env.isDev() ? '-dev' : '') + '.png');
}

async function createSetupWindow() {
    const {BrowserWindow} = require('electron'); // should not be statically imported
    setupWindow = new BrowserWindow({
        width: 800,
        height: 800,
        title: 'Trilium Notes Setup',
        icon: getIcon()
    });

    setupWindow.setMenuBarVisibility(false);
    setupWindow.loadURL('http://127.0.0.1:' + await port);
    setupWindow.on('closed', () => setupWindow = null);
}

function closeSetupWindow() {
    if (setupWindow) {
        setupWindow.close();
    }
}

module.exports = {
    createMainWindow,
    createSetupWindow,
    closeSetupWindow
};