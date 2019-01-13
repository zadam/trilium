"use strict";

const sourceIdService = require('../services/source_id');
const sql = require('../services/sql');
const attributeService = require('../services/attributes');
const config = require('../services/config');
const optionService = require('../services/options');

async function index(req, res) {
    const options = await optionService.getOptionsMap();

    const view = req.cookies['trilium-device'] === 'mobile' ? 'mobile' : 'desktop';

    res.render(view, {
        theme: options.theme,
        leftPaneMinWidth: parseInt(options.leftPaneMinWidth),
        leftPaneWidthPercent: parseInt(options.leftPaneWidthPercent),
        rightPaneWidthPercent: 100 - parseInt(options.leftPaneWidthPercent),
        mainFontSize: parseInt(options.mainFontSize),
        treeFontSize: parseInt(options.treeFontSize),
        detailFontSize: parseInt(options.detailFontSize),
        sourceId: await sourceIdService.generateSourceId(),
        maxSyncIdAtLoad: await sql.getValue("SELECT MAX(id) FROM sync"),
        instanceName: config.General ? config.General.instanceName : null,
        appCss: await getAppCss()
    });
}

async function getAppCss() {
    let css = '';
    const notes = attributeService.getNotesWithLabel('appCss');

    for (const note of await notes) {
        css += `/* ${note.noteId} */
${note.content}

`;
    }

    return css;
}

module.exports = {
    index
};
