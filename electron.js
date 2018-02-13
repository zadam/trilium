'use strict';

const electron = require('electron');
const path = require('path');
const config = require('./src/services/config');
const url = require("url");

const app = electron.app;
const globalShortcut = electron.globalShortcut;
const clipboard = electron.clipboard;

// Adds debug features like hotkeys for triggering dev tools and reload
require('electron-debug')();

// Prevent window being garbage collected
let mainWindow;

function onClosed() {
    // Dereference the window
    // For multiple windows store them in an array
    mainWindow = null;
}

function createMainWindow() {
    const win = new electron.BrowserWindow({
        width: 1200,
        height: 900,
        title: 'Trilium Notes',
        icon: path.join(__dirname, 'src/public/images/app-icons/png/256x256.png')
    });

    const port = config['Network']['port'] || '3000';

    win.setMenu(null);
    win.loadURL('http://localhost:' + port);
    win.on('closed', onClosed);

    win.webContents.on('new-window', (e, url) => {
        if (url !== mainWindow.webContents.getURL()) {
            e.preventDefault();
            require('electron').shell.openExternal(url);
        }
    });

    // prevent drag & drop to navigate away from trilium
    win.webContents.on('will-navigate', (ev, targetUrl) => {
        const parsedUrl = url.parse(targetUrl);

        // we still need to allow internal redirects from setup and migration pages
        if (parsedUrl.hostname !== 'localhost' || (parsedUrl.path && parsedUrl.path !== '/')) {
            ev.preventDefault();
        }
    });

    return win;
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (!mainWindow) {
        mainWindow = createMainWindow();
    }
});

app.on('ready', () => {
    mainWindow = createMainWindow();

    const date_notes = require('./src/services/date_notes');
    const utils = require('./src/services/utils');

    globalShortcut.register('CommandOrControl+Alt+P', async () => {
        const parentNoteId = await date_notes.getDateNoteId(utils.nowDate());

        // window may be hidden / not in focus
        mainWindow.focus();

        mainWindow.webContents.send('create-sub-note', JSON.stringify({
            parentNoteId: parentNoteId,
            content: ''
        }));
    });

    globalShortcut.register('CommandOrControl+Alt+C', async () => {
        const parentNoteId = await date_notes.getDateNoteId(utils.nowDate());

        // window may be hidden / not in focus
        mainWindow.focus();

        let content = clipboard.readText();
        content = content.replace(/(\r\n|\n)/g, "<p>");

        mainWindow.webContents.send('create-sub-note', JSON.stringify({
            parentNoteId: parentNoteId,
            content: content
        }));
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

require('./src/www');
