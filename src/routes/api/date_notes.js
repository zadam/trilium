"use strict";

const dateNoteService = require('../../services/date_notes');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const noteService = require('../../services/notes');

async function getDateNote(req) {
    return await dateNoteService.getDateNote(req.params.date);
}

async function getMonthNote(req) {
    return await dateNoteService.getMonthNote(req.params.month);
}

async function getYearNote(req) {
    return await dateNoteService.getYearNote(req.params.year);
}

async function getDateNotesForMonth(req) {
    const month = req.params.month;

    return sql.getMap(`
        SELECT
            attr.value AS date,
            notes.noteId
        FROM notes
        JOIN attributes attr USING(noteId)
        WHERE notes.isDeleted = 0
            AND attr.isDeleted = 0
            AND attr.type = 'label'
            AND attr.name = 'dateNote'
            AND attr.value LIKE '${month}%'`);
}

async function createSqlConsole() {
    const today = dateUtils.localNowDate();

    const todayNote = await dateNoteService.getDateNote(today);

    const {note} = await noteService.createNewNote({
        parentNoteId: todayNote.noteId,
        title: 'SQL Console',
        content: "SELECT title, isDeleted, isProtected FROM notes WHERE noteId = ''\n\n\n\n",
        type: 'code',
        mime: 'text/x-sqlite;schema=trilium'
    });

    await note.setLabel("sqlConsole", today);

    return note;
}

module.exports = {
    getDateNote,
    getMonthNote,
    getYearNote,
    getDateNotesForMonth,
    createSqlConsole
};