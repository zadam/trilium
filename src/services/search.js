const repository = require('./repository');
const sql = require('./sql');
const log = require('./log');
const parseFilters = require('./parse_filters');
const buildSearchQuery = require('./build_search_query');
const noteCacheService = require('./note_cache');

async function searchForNotes(searchString) {
    const noteIds = await searchForNoteIds(searchString);

    return await repository.getNotes(noteIds);
}

async function searchForNoteIds(searchString) {
    const filters = parseFilters(searchString);

    const {query, params} = buildSearchQuery(filters, 'notes.noteId');

    try {
        const noteIds = await sql.getColumn(query, params);

        const availableNoteIds = noteIds.filter(noteCacheService.isAvailable);

        const limitFilter = filters.find(filter => filter.name.toLowerCase() === 'limit');

        if (limitFilter) {
            const limit = parseInt(limitFilter.value);

            return availableNoteIds.splice(0, limit);
        }
        else {
            return availableNoteIds;
        }

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