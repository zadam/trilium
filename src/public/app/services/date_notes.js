import treeCache from "./tree_cache.js";
import server from "./server.js";

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

export default {
    getTodayNote,
    getDateNote,
    getMonthNote,
    getYearNote
}