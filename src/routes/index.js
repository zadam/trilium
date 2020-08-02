"use strict";

const sourceIdService = require('../services/source_id');
const sql = require('../services/sql');
const attributeService = require('../services/attributes');
const config = require('../services/config');
const optionService = require('../services/options');
const log = require('../services/log');
const env = require('../services/env');

function index(req, res) {
    const options = optionService.getOptionsMap();

    let view = req.cookies['trilium-device'] === 'mobile' ? 'mobile' : 'desktop';

    const csrfToken = req.csrfToken();
    log.info(`Generated CSRF token ${csrfToken} with secret ${res.getHeader('set-cookie')}`);

    res.render(view, {
        csrfToken: csrfToken,
        theme: options.theme,
        mainFontSize: parseInt(options.mainFontSize),
        treeFontSize: parseInt(options.treeFontSize),
        detailFontSize: parseInt(options.detailFontSize),
        sourceId: sourceIdService.generateSourceId(),
        maxEntityChangeIdAtLoad: sql.getValue("SELECT COALESCE(MAX(id), 0) FROM entity_changes"),
        instanceName: config.General ? config.General.instanceName : null,
        appCssNoteIds: getAppCssNoteIds(),
        isDev: env.isDev(),
        isMainWindow: !req.query.extra
    });
}

function getAppCssNoteIds() {
    return (attributeService.getNotesWithLabels(['appCss', 'appTheme']))
        .map(note => note.noteId);
}

module.exports = {
    index
};
