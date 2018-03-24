"use strict";

const express = require('express');
const router = express.Router();
const auth = require('../../services/auth');
const sql = require('../../services/sql');
const notes = require('../../services/notes');
const wrap = require('express-promise-wrap').wrap;
const parseFilters = require('../../services/parse_filters');
const buildSearchQuery = require('../../services/build_search_query');

router.get('/:searchString', auth.checkApiAuth, wrap(async (req, res, next) => {
    const {attrFilters, searchText} = parseFilters(req.params.searchString);

    const {query, params} = buildSearchQuery(attrFilters, searchText);

    const noteIds = await sql.getColumn(query, params);

    res.send(noteIds);
}));

router.post('/:searchString', auth.checkApiAuth, wrap(async (req, res, next) => {
    const noteContent = {
        searchString: req.params.searchString
    };

    const noteId = await notes.createNote('root', 'Search note', noteContent, {
        json: true,
        type: 'search'
    });

    res.send({ noteId });
}));

module.exports = router;