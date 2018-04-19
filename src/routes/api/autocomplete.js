"use strict";

const autocompleteService = require('../../services/autocomplete');

async function getAutocomplete(req) {
    const query = req.query.query;

    const results = autocompleteService.getResults(query);

    return results.map(res => {
        return {
            value: res.title + ' (' + res.path + ')',
            title: res.title
        }
    });
}

module.exports = {
    getAutocomplete
};