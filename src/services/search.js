const repository = require('./repository');
const sql = require('./sql');
const log = require('./log');
const parseFilters = require('./parse_filters');
const buildSearchQuery = require('./build_search_query');

async function searchForNotes(searchString) {
    const filters = parseFilters(searchString);

    const {query, params} = buildSearchQuery(filters);

    try {
        return await repository.getEntities(query, params);
    }
    catch (e) {
        log.error("Search failed for " + query);

        throw e;
    }
}

async function searchForNoteIds(searchString) {
    const filters = parseFilters(searchString);

    const {query, params} = buildSearchQuery(filters, 'notes.noteId');

    try {
        return await sql.getColumn(query, params);
    }
    catch (e) {
        log.error("Search failed for " + query);

        throw e;
    }
}

module.exports = {
    searchForNotes,
    searchForNoteIds
};