"use strict";

const path = require('path');
const {APP_PNG_ICON_DIR} = require("./resource_dir");
const log = require("./log");
const os = require('os');
const fs = require('fs');

const template = `[Desktop Entry]
Type=Application
Name=Trilium Notes
Icon=#APP_PNG_ICON_DIR#/128x128.png
Exec=#EXE_PATH#
Categories=Office
Terminal=false
`;

/**
 * Installs .desktop icon into standard ~/.local/share/applications directory.
 * We overwrite this file during every run as it might have been updated.
 */
async function installLocalAppIcon() {
    if (["win32", "darwin"].includes(os.platform())) {
        return;
    }

    const desktopDir = path.resolve(os.homedir(), '.local/share/applications');

    fs.stat(desktopDir, function (err, stats) {
        if (err) {
            // Directory doesn't exist so we won't attempt to create the .desktop file
            return;
        }

        if (stats.isDirectory()) {
            const desktopFilePath = path.resolve(desktopDir, "trilium-notes.desktop");

            fs.writeFile(desktopFilePath, getDesktopFileContent(), function (err) {
                if (err) {
                   log.error("Desktop icon installation to ~/.local/share/applications failed.");
                }
            });
        }
    });
}

function getDesktopFileContent() {
    return template
        .replace("#APP_PNG_ICON_DIR#", escapePath(APP_PNG_ICON_DIR))
        .replace("#EXE_PATH#", escapePath(getExePath()));
}

function escapePath(path) {
    return path.replace(" ", "\\ ");
}

function getExePath() {
    const appPath = require('electron').app.getAppPath();

    return path.resolve(appPath, 'trilium');
}

module.exports = {
    installLocalAppIcon
};