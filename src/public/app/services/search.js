import server from "./server.js";
import treeCache from "./tree_cache.js";

async function searchForNoteIds(searchString) {
    return await server.get('search/' + encodeURIComponent(searchString));
}

async function searchForNotes(searchString) {
    const noteIds = await searchForNoteIds(searchString);

    return await treeCache.getNotes(noteIds);
}

export default {
    searchForNoteIds,
    searchForNotes
}
