import path = require('path');
import url = require("url");
import port = require('./port');
import optionService = require('./options');
import env = require('./env');
import log = require('./log');
import sqlInit = require('./sql_init');
import cls = require('./cls');
import keyboardActionsService = require('./keyboard_actions');
import remoteMain = require("@electron/remote/main")
import { App, BrowserWindow, WebContents, ipcMain } from 'electron';

// Prevent the window being garbage collected
let mainWindow: BrowserWindow | null;
let setupWindow: BrowserWindow | null;

async function createExtraWindow(extraWindowHash: string) {
    const spellcheckEnabled = optionService.getOptionBool('spellCheckEnabled');

    const { BrowserWindow } = require('electron');

    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        title: 'Trilium Notes',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            spellcheck: spellcheckEnabled
        },
        frame: optionService.getOptionBool('nativeTitleBarVisible'),
        icon: getIcon()
    });

    win.setMenuBarVisibility(false);
    win.loadURL(`http://127.0.0.1:${port}/?extraWindow=1${extraWindowHash}`);

    configureWebContents(win.webContents, spellcheckEnabled);
}

ipcMain.on('create-extra-window', (event, arg) => {
    createExtraWindow(arg.extraWindowHash);
});

async function createMainWindow(app: App) {
    const windowStateKeeper = require('electron-window-state'); // should not be statically imported

    const mainWindowState = windowStateKeeper({
        // default window width & height, so it's usable on a 1600 * 900 display (including some extra panels etc.)
        defaultWidth: 1200,
        defaultHeight: 800
    });

    const spellcheckEnabled = optionService.getOptionBool('spellCheckEnabled');

    const { BrowserWindow } = require('electron'); // should not be statically imported

    mainWindow = new BrowserWindow({
        x: mainWindowState.x,
        y: mainWindowState.y,
        width: mainWindowState.width,
        height: mainWindowState.height,
        title: 'Trilium Notes',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            spellcheck: spellcheckEnabled,
            webviewTag: true
        },
        frame: optionService.getOptionBool('nativeTitleBarVisible'),
        icon: getIcon()
    });

    mainWindowState.manage(mainWindow);

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
    mainWindow.on('closed', () => mainWindow = null);

    configureWebContents(mainWindow.webContents, spellcheckEnabled);

    app.on('second-instance', () => {
        // Someone tried to run a second instance, we should focus our window.
        // see www.ts "requestSingleInstanceLock" for the rest of this logic with explanation
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }

            mainWindow.focus();
        }
    });
}

function configureWebContents(webContents: WebContents, spellcheckEnabled: boolean) {
    if (!mainWindow) {
        return;
    }

    remoteMain.enable(webContents);

    mainWindow.webContents.setWindowOpenHandler((details) => {
        require("electron").shell.openExternal(details.url);
        return { action: 'deny' }
    });

    // prevent drag & drop to navigate away from trilium
    webContents.on('will-navigate', (ev, targetUrl) => {
        const parsedUrl = url.parse(targetUrl);

        // we still need to allow internal redirects from setup and migration pages
        if (!['localhost', '127.0.0.1'].includes(parsedUrl.hostname || "") || (parsedUrl.path && parsedUrl.path !== '/' && parsedUrl.path !== '/?')) {
            ev.preventDefault();
        }
    });

    if (spellcheckEnabled) {
        const languageCodes = (optionService.getOption('spellCheckLanguageCode'))
            .split(',')
            .map(code => code.trim());

        webContents.session.setSpellCheckerLanguages(languageCodes);
    }
}

function getIcon() {
    return path.join(__dirname, '../../images/app-icons/png/256x256' + (env.isDev() ? '-dev' : '') + '.png');
}

async function createSetupWindow() {
    const { BrowserWindow } = require('electron'); // should not be statically imported
    setupWindow = new BrowserWindow({
        width: 800,
        height: 800,
        title: 'Trilium Notes Setup',
        icon: getIcon(),
        webPreferences: {
            // necessary for e.g. utils.isElectron()
            nodeIntegration: true
        }
    });

    setupWindow.setMenuBarVisibility(false);
    setupWindow.loadURL(`http://127.0.0.1:${port}`);
    setupWindow.on('closed', () => setupWindow = null);
}

function closeSetupWindow() {
    if (setupWindow) {
        setupWindow.close();
    }
}

async function registerGlobalShortcuts() {
    const { globalShortcut } = require('electron');

    await sqlInit.dbReady;

    const allActions = keyboardActionsService.getKeyboardActions();

    for (const action of allActions) {
        if (!action.effectiveShortcuts) {
            continue;
        }

        for (const shortcut of action.effectiveShortcuts) {
            if (shortcut.startsWith('global:')) {
                const translatedShortcut = shortcut.substr(7);

                const result = globalShortcut.register(translatedShortcut, cls.wrap(() => {
                    if (!mainWindow) {
                        return;
                    }

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

function getMainWindow() {
    return mainWindow;
}

export = {
    createMainWindow,
    createSetupWindow,
    closeSetupWindow,
    registerGlobalShortcuts,
    getMainWindow
};
