"use strict";

const path = require('path');
const {ELECTRON_APP_ROOT_DIR} = require("./resource_dir");
const log = require("./log");
const os = require('os');
const fs = require('fs');
const config = require('./config');
const utils = require('./utils');

const template = `[Desktop Entry]
Type=Application
Name=Trilium Notes
Icon=#APP_ROOT_DIR#/icon.png
Exec=#EXE_PATH#
Categories=Office
Terminal=false
`;

/**
 * Installs .desktop icon into standard ~/.local/share/applications directory.
 * We overwrite this file during every run as it might have been updated.
 */
function installLocalAppIcon() {
    if (!utils.isElectron()
        || ["win32", "darwin"].includes(os.platform())
        || (config.General && config.General.noDesktopIcon)) {
        return;
    }

    if (!fs.existsSync(path.resolve(ELECTRON_APP_ROOT_DIR, "trilium-portable.sh"))) {
        // simple heuristic to detect ".tar.xz" linux build (i.e. not flatpak, not debian)
        // only in such case it's necessary to create an icon
        return;
    }

    const desktopDir = path.resolve(os.homedir(), '.local/share/applications');

    fs.stat(desktopDir, function (err, stats) {
        if (err) {
            // Directory doesn't exist, so we won't attempt to create the .desktop file
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
        .replace("#APP_ROOT_DIR#", escapePath(ELECTRON_APP_ROOT_DIR))
        .replace("#EXE_PATH#", escapePath(getExePath()));
}

function escapePath(path) {
    return path.replace(/ /g, "\\ ");
}

function getExePath() {
     return path.resolve(ELECTRON_APP_ROOT_DIR, 'trilium');
}

module.exports = {
    installLocalAppIcon
};
