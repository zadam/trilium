import { Menu, Tray } from 'electron';
import path = require('path');
import windowService = require('./window');
import optionService = require('./options');

let tray: Tray;
// `mainWindow.isVisible` doesn't work with `mainWindow.show` and `mainWindow.hide` - it returns `false` when the window
// is minimized
let isVisible = true;

// Inspired by https://github.com/signalapp/Signal-Desktop/blob/dcb5bb672635c4b29a51adec8a5658e3834ec8fc/app/tray_icon.ts#L20
const getIconSize = () => {
    switch (process.platform) {
        case 'darwin':
            return 16;
        case 'win32':
            return 32;
        default:
            return 256;
    }
}
const getIconPath = () => {
    const iconSize = getIconSize();

    return path.join(
        __dirname,
        "../..",
        "images",
        "app-icons",
        "png",
        `${iconSize}x${iconSize}.png`
    )
}
const registerVisibilityListener = () => {
    const mainWindow = windowService.getMainWindow();
    if (!mainWindow) { return; }

    // They need to be registered before the tray updater is registered
    mainWindow.on('show', () => {
        isVisible = true;
        updateTrayMenu();
    });
    mainWindow.on('hide', () => {
        isVisible = false;
        updateTrayMenu();
    });

    mainWindow.on("minimize", updateTrayMenu);
    mainWindow.on("maximize", updateTrayMenu);
}

const updateTrayMenu = () => {
    const mainWindow = windowService.getMainWindow();
    if (!mainWindow) { return; }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: isVisible ? 'Hide' : 'Show',
            type: 'normal',
            click: () => {
                if (isVisible) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            type: 'normal',
            click: () => {
                mainWindow.close();
            }
        },
    ]);

    tray?.setContextMenu(contextMenu);
}
const changeVisibility = () => {
    const window = windowService.getMainWindow();
    if (!window) { return; }

    if (isVisible) {
        window.hide();
    } else {
        window.show();
        window.focus();
    }
}

function createTray() {
    if (optionService.getOptionBool("disableTray")) {
        return;
    }

    tray = new Tray(getIconPath());
    tray.setToolTip('Trilium Notes')
    // Restore focus
    tray.on('click', changeVisibility)
    updateTrayMenu();

    registerVisibilityListener();
}

export = {
    createTray
}
