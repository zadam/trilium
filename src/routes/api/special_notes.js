"use strict";

const dateNoteService = require('../../services/date_notes');
const sql = require('../../services/sql');
const cls = require('../../services/cls');
const specialNotesService = require('../../services/special_notes');
const becca = require('../../becca/becca');

function getInboxNote(req) {
    return specialNotesService.getInboxNote(req.params.date);
}

function getDayNote(req) {
    return dateNoteService.getDayNote(req.params.date);
}

function getWeekNote(req) {
    return dateNoteService.getWeekNote(req.params.date);
}

function getMonthNote(req) {
    return dateNoteService.getMonthNote(req.params.month);
}

function getYearNote(req) {
    return dateNoteService.getYearNote(req.params.year);
}

function getDayNotesForMonth(req) {
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

function saveSqlConsole(req) {
    return specialNotesService.saveSqlConsole(req.body.sqlConsoleNoteId);
}

function createSqlConsole() {
    return specialNotesService.createSqlConsole();
}

function saveSearchNote(req) {
    return specialNotesService.saveSearchNote(req.body.searchNoteId);
}

function createSearchNote(req) {
    const hoistedNote = getHoistedNote();
    const searchString = req.body.searchString || "";
    const ancestorNoteId = req.body.ancestorNoteId || hoistedNote.noteId;

    return specialNotesService.createSearchNote(searchString, ancestorNoteId);
}

function getHoistedNote() {
    return becca.getNote(cls.getHoistedNoteId());
}

module.exports = {
    getInboxNote,
    getDayNote,
    getWeekNote,
    getMonthNote,
    getYearNote,
    getDayNotesForMonth,
    createSqlConsole,
    saveSqlConsole,
    createSearchNote,
    saveSearchNote
};
