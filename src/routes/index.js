"use strict";

const sql = require('../services/sql.js');
const attributeService = require('../services/attributes.js');
const config = require('../services/config.js');
const optionService = require('../services/options.js');
const log = require('../services/log.ts');
const env = require('../services/env.js');
const utils = require('../services/utils.js');
const protectedSessionService = require('../services/protected_session.js');
const packageJson = require('../../package.json');
const assetPath = require('../services/asset_path.js');
const appPath = require('../services/app_path.js');

function index(req, res) {
    const options = optionService.getOptionMap();

    const view = (!utils.isElectron() && req.cookies['trilium-device'] === 'mobile')
        ? 'mobile'
        : 'desktop';

    const csrfToken = req.csrfToken();
    log.info(`Generated CSRF token ${csrfToken} with secret ${res.getHeader('set-cookie')}`);

    res.render(view, {
        csrfToken: csrfToken,
        themeCssUrl: getThemeCssUrl(options.theme),
        headingStyle: options.headingStyle,
        mainFontSize: parseInt(options.mainFontSize),
        treeFontSize: parseInt(options.treeFontSize),
        detailFontSize: parseInt(options.detailFontSize),
        maxEntityChangeIdAtLoad: sql.getValue("SELECT COALESCE(MAX(id), 0) FROM entity_changes"),
        maxEntityChangeSyncIdAtLoad: sql.getValue("SELECT COALESCE(MAX(id), 0) FROM entity_changes WHERE isSynced = 1"),
        instanceName: config.General ? config.General.instanceName : null,
        appCssNoteIds: getAppCssNoteIds(),
        isDev: env.isDev(),
        isMainWindow: !req.query.extraWindow,
        isProtectedSessionAvailable: protectedSessionService.isProtectedSessionAvailable(),
        maxContentWidth: parseInt(options.maxContentWidth),
        triliumVersion: packageJson.version,
        assetPath: assetPath,
        appPath: appPath
    });
}

function getThemeCssUrl(theme) {
    if (theme === 'light') {
        return false; // light theme is always loaded as baseline
    } else if (theme === 'dark') {
        return `${assetPath}/stylesheets/theme-dark.css`;
    } else {
        const themeNote = attributeService.getNoteWithLabel('appTheme', theme);

        if (themeNote) {
            return `api/notes/download/${themeNote.noteId}`;
        } else {
            return false; // baseline light theme
        }
    }
}

function getAppCssNoteIds() {
    return attributeService.getNotesWithLabel('appCss').map(note => note.noteId);
}

module.exports = {
    index
};
