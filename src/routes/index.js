"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const source_id = require('../services/source_id');
const sql = require('../services/sql');
const Repository = require('../services/repository');
const attributes = require('../services/attributes');
const wrap = require('express-promise-wrap').wrap;

router.get('', auth.checkAuth, wrap(async (req, res, next) => {
    const repository = new Repository(req);

    res.render('index', {
        sourceId: await source_id.generateSourceId(),
        maxSyncIdAtLoad: await sql.getValue("SELECT MAX(id) FROM sync"),
        appCss: await getAppCss(repository)
    });
}));

async function getAppCss(repository) {
    let css = '';
    const notes = attributes.getNotesWithAttribute(repository, 'app_css');

    for (const note of await notes) {
        css += `/* ${note.noteId} */
${note.content}

`;
    }

    return css;
}

module.exports = router;
