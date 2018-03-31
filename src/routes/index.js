"use strict";

const source_id = require('../services/source_id');
const sql = require('../services/sql');
const repository = require('../services/repository');
const labels = require('../services/labels');

async function index(req, res) {
    res.render('index', {
        sourceId: await source_id.generateSourceId(),
        maxSyncIdAtLoad: await sql.getValue("SELECT MAX(id) FROM sync"),
        appCss: await getAppCss()
    });
}

async function getAppCss() {
    let css = '';
    const notes = labels.getNotesWithLabel('app_css');

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
