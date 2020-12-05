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

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function getMonthNote(month) {
    const note = await server.get('date-notes/month/' + month, "date-note");

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function getYearNote(year) {
    const note = await server.get('date-notes/year/' + year, "date-note");

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function createSqlConsole() {
    const note = await server.post('sql-console');

    return await treeCache.getNote(note.noteId);
}

/** @return {NoteShort} */
async function createSearchNote(subTreeNoteId = null) {
    const note = await server.post('search-note');

    if (subTreeNoteId) {
        await server.put(`notes/${note.noteId}/attributes`, [
            { type: 'label', name: 'subTreeNoteId', value: subTreeNoteId }
        ]);
    }

    await ws.waitForMaxKnownEntityChangeId();

    const noteShort = await treeCache.getNote(note.noteId);

    return noteShort;
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
