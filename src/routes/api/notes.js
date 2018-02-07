"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const log = require('../../services/log');
const utils = require('../../services/utils');
const protected_session = require('../../services/protected_session');
const tree = require('../../services/tree');
const sync_table = require('../../services/sync_table');
const wrap = require('express-promise-wrap').wrap;

router.get('/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;

    const detail = await sql.getRow("SELECT * FROM notes WHERE noteId = ?", [noteId]);

    if (!detail) {
        log.info("Note " + noteId + " has not been found.");

        return res.status(404).send({});
    }

    protected_session.decryptNote(req, detail);

    res.send({
        detail: detail
    });
}));

router.post('/:parentNoteId/children', auth.checkApiAuth, wrap(async (req, res, next) => {
    const sourceId = req.headers.source_id;
    const parentNoteId = req.params.parentNoteId;
    const newNote = req.body;

    await sql.doInTransaction(async () => {
        const { noteId, noteTreeId, note } = await notes.createNewNote(parentNoteId, newNote, req, sourceId);

        res.send({
            'noteId': noteId,
            'noteTreeId': noteTreeId,
            'note': note
        });
    });
}));

router.put('/:noteId', auth.checkApiAuth, wrap(async (req, res, next) => {
    const note = req.body;
    const noteId = req.params.noteId;
    const sourceId = req.headers.source_id;
    const dataKey = protected_session.getDataKey(req);

    await notes.updateNote(noteId, note, dataKey, sourceId);

    res.send({});
}));

router.get('/', auth.checkApiAuth, wrap(async (req, res, next) => {
    let {attrFilters, searchText} = parseFilters(req.query.search);

    const {query, params} = getSearchQuery(attrFilters, searchText);

    console.log(query, params);

    const noteIds = await sql.getColumn(query, params);

    res.send(noteIds);
}));

function parseFilters(searchText) {
    const attrFilters = [];

    const attrRegex = /(\b(and|or)\s+)?@(!?)([\w_-]+|"[^"]+")((=|!=|<|<=|>|>=)([\w_-]+|"[^"]+"))?/i;

    let match = attrRegex.exec(searchText);

    function trimQuotes(str) { return str.startsWith('"') ? str.substr(1, str.length - 2) : str; }

    while (match != null) {
        const relation = match[2] !== undefined ? match[2].toLowerCase() : 'and';
        const operator = match[3] === '!' ? 'not-exists' : 'exists';

        attrFilters.push({
            relation: relation,
            name: trimQuotes(match[4]),
            operator: match[6] !== undefined ? match[6] : operator,
            value: match[7] !== undefined ? trimQuotes(match[7]) : null
        });

        // remove attributes from further fulltext search
        searchText = searchText.split(match[0]).join('');

        match = attrRegex.exec(searchText);
    }

    return {attrFilters, searchText};
}

function getSearchQuery(attrFilters, searchText) {
    const joins = [];
    const joinParams = [];
    let where = '1';
    const whereParams = [];

    let i = 1;

    for (const filter of attrFilters) {
        joins.push(`LEFT JOIN attributes AS attr${i} ON attr${i}.noteId = notes.noteId AND attr${i}.name = ?`);
        joinParams.push(filter.name);

        where += " " + filter.relation + " ";

        if (filter.operator === 'exists') {
            where += `attr${i}.attributeId IS NOT NULL`;
        }
        else if (filter.operator === 'not-exists') {
            where += `attr${i}.attributeId IS NULL`;
        }
        else if (filter.operator === '=' || filter.operator === '!=') {
            where += `attr${i}.value ${filter.operator} ?`;
            whereParams.push(filter.value);
        }
        else if ([">", ">=", "<", "<="].includes(filter.operator)) {
            const floatParam = parseFloat(filter.value);

            if (isNaN(floatParam)) {
                where += `attr${i}.value ${filter.operator} ?`;
                whereParams.push(filter.value);
            }
            else {
                where += `CAST(attr${i}.value AS DECIMAL) ${filter.operator} ?`;
                whereParams.push(floatParam);
            }
        }
        else {
            throw new Error("Unknown operator " + filter.operator);
        }

        i++;
    }

    let searchCondition = '';
    const searchParams = [];

    if (searchText.trim() !== '') {
        // searching in protected notes is pointless because of encryption
        searchCondition = ' AND (notes.isProtected = 0 AND (notes.title LIKE ? OR notes.content LIKE ?))';

        searchText = '%' + searchText.trim() + '%';

        searchParams.push(searchText);
        searchParams.push(searchText); // two occurences in searchCondition
    }

    const query = `SELECT DISTINCT notes.noteId FROM notes
            ${joins.join('\r\n')}
              WHERE 
                notes.isDeleted = 0
                AND (${where}) 
                ${searchCondition}`;

    const params = joinParams.concat(whereParams).concat(searchParams);

    return { query, params };
}

router.put('/:noteId/sort', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const sourceId = req.headers.source_id;
    const dataKey = protected_session.getDataKey(req);

    await tree.sortNotesAlphabetically(noteId, dataKey, sourceId);

    res.send({});
}));

router.put('/:noteId/protect-sub-tree/:isProtected', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params.noteId;
    const isProtected = !!parseInt(req.params.isProtected);
    const dataKey = protected_session.getDataKey(req);
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
        await notes.protectNoteRecursively(noteId, dataKey, isProtected, sourceId);
    });

    res.send({});
}));

router.put(/\/(.*)\/type\/(.*)\/mime\/(.*)/, auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteId = req.params[0];
    const type = req.params[1];
    const mime = req.params[2];
    const sourceId = req.headers.source_id;

    await sql.doInTransaction(async () => {
       await sql.execute("UPDATE notes SET type = ?, mime = ?, dateModified = ? WHERE noteId = ?",
           [type, mime, utils.nowDate(), noteId]);

       await sync_table.addNoteSync(noteId, sourceId);
    });

    res.send({});
}));

module.exports = router;