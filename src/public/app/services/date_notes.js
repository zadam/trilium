import treeCache from "./tree_cache.js";
import server from "./server.js";
import ws from "./ws.js";

/** @return {NoteShort} */
async function getInboxNote() {
    const note = await server.get('date-notes/inbox/' + dayjs().format("YYYY-MM-DD"), "date-note");

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function getTodayNote() {
    return await getDateNote(dayjs().format("YYYY-MM-DD"));
}

/** @return {NoteShort} */
async function getDateNote(date) {
    const note = await server.get('date-notes/date/' + date, "date-note");

    await ws.waitForMaxKnownEntityChangeId();

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function getMonthNote(month) {
    const note = await server.get('date-notes/month/' + month, "date-note");

    await ws.waitForMaxKnownEntityChangeId();

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function getYearNote(year) {
    const note = await server.get('date-notes/year/' + year, "date-note");

    await ws.waitForMaxKnownEntityChangeId();

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function createSqlConsole() {
    const note = await server.post('sql-console');

    await ws.waitForMaxKnownEntityChangeId();

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function createSearchNote(opts = {}) {
    const note = await server.post('search-note', opts);

    await ws.waitForMaxKnownEntityChangeId();

    return await treeCache.getNote(note.noteId);
}

export default {
    getInboxNote,
    getTodayNote,
    getDateNote,
    getMonthNote,
    getYearNote,
    createSqlConsole,
    createSearchNote
}
