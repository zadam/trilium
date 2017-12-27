'use strict';
const electron = require('electron');
const path = require('path');
const config = require('./services/config');

const app = electron.app;

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
        icon: path.join(__dirname, 'public/images/app-icons/png/256x256.png')
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
});

require('./bin/www');
