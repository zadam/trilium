"use strict";

const source_id = require('../services/source_id');
const sql = require('../services/sql');
const Repository = require('../services/repository');
const labels = require('../services/labels');

async function index(req, res) {
    const repository = new Repository(req);

    res.render('index', {
        sourceId: await source_id.generateSourceId(),
        maxSyncIdAtLoad: await sql.getValue("SELECT MAX(id) FROM sync"),
        appCss: await getAppCss(repository)
    });
}

async function getAppCss(repository) {
    let css = '';
    const notes = labels.getNotesWithLabel(repository, 'app_css');

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
