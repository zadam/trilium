const repository = require('./repository');
const sql = require('./sql');
const parseFilters = require('./parse_filters');
const buildSearchQuery = require('./build_search_query');

async function searchForNotes(searchString) {
    const filters = parseFilters(searchString);

    const {query, params} = buildSearchQuery(filters);

    return await repository.getEntities(query, params);
}

async function searchForNoteIds(searchString) {
    const filters = parseFilters(searchString);

    const {query, params} = buildSearchQuery(filters, 'notes.noteId');

    return await sql.getColumn(query, params);
}

module.exports = {
    searchForNotes,
    searchForNoteIds
};