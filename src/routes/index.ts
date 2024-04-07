"use strict";

import sql = require('../services/sql');
import attributeService = require('../services/attributes');
import config = require('../services/config');
import optionService = require('../services/options');
import log = require('../services/log');
import env = require('../services/env');
import utils = require('../services/utils');
import protectedSessionService = require('../services/protected_session');
import packageJson = require('../../package.json');
import assetPath = require('../services/asset_path');
import appPath = require('../services/app_path');
import { Request, Response } from 'express';

function index(req: Request, res: Response) {
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

function getThemeCssUrl(theme: string) {
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

export = {
    index
};
