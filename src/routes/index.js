"use strict";

const sourceIdService = require('../services/source_id');
const sql = require('../services/sql');
const labelService = require('../services/labels');
const config = require('../services/config');
const optionService = require('../services/options');

async function index(req, res) {
    res.render('index', {
        theme: await optionService.getOption('theme'),
        sourceId: await sourceIdService.generateSourceId(),
        maxSyncIdAtLoad: await sql.getValue("SELECT MAX(id) FROM sync"),
        instanceName: config.General ? config.General.instanceName : null,
        appCss: await getAppCss()
    });
}

async function getAppCss() {
    let css = '';
    const notes = labelService.getNotesWithLabel('appCss');

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
