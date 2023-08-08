import server from "./server.js";
import froca from "./froca.js";

async function searchForNoteIds(searchString) {
    return await server.get(`search/${encodeURIComponent(searchString)}`);
}

async function searchForNotes(searchString) {
    const noteIds = await searchForNoteIds(searchString);

    return await froca.getNotes(noteIds);
}

export default {
    searchForNoteIds,
    searchForNotes
}
