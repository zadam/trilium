"use strict";

import dateNoteService = require('../../services/date_notes');
import sql = require('../../services/sql');
import cls = require('../../services/cls');
import specialNotesService = require('../../services/special_notes');
import becca = require('../../becca/becca');
import { Request } from 'express';

function getInboxNote(req: Request) {
    return specialNotesService.getInboxNote(req.params.date);
}

function getDayNote(req: Request) {
    return dateNoteService.getDayNote(req.params.date);
}

function getWeekNote(req: Request) {
    return dateNoteService.getWeekNote(req.params.date);
}

function getMonthNote(req: Request) {
    return dateNoteService.getMonthNote(req.params.month);
}

function getYearNote(req: Request) {
    return dateNoteService.getYearNote(req.params.year);
}

function getDayNotesForMonth(req: Request) {
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

function saveSqlConsole(req: Request) {
    return specialNotesService.saveSqlConsole(req.body.sqlConsoleNoteId);
}

function createSqlConsole() {
    return specialNotesService.createSqlConsole();
}

function saveSearchNote(req: Request) {
    return specialNotesService.saveSearchNote(req.body.searchNoteId);
}

function createSearchNote(req: Request) {
    const hoistedNote = getHoistedNote();
    const searchString = req.body.searchString || "";
    const ancestorNoteId = req.body.ancestorNoteId || hoistedNote?.noteId;

    return specialNotesService.createSearchNote(searchString, ancestorNoteId);
}

function getHoistedNote() {
    return becca.getNote(cls.getHoistedNoteId());
}

function createLauncher(req: Request) {
    return specialNotesService.createLauncher({
        parentNoteId: req.params.parentNoteId,
        launcherType: req.params.launcherType
    });
}

function resetLauncher(req: Request) {
    return specialNotesService.resetLauncher(req.params.noteId);
}

function createOrUpdateScriptLauncherFromApi(req: Request) {
    return specialNotesService.createOrUpdateScriptLauncherFromApi(req.body);
}

export = {
    getInboxNote,
    getDayNote,
    getWeekNote,
    getMonthNote,
    getYearNote,
    getDayNotesForMonth,
    createSqlConsole,
    saveSqlConsole,
    createSearchNote,
    saveSearchNote,
    createLauncher,
    resetLauncher,
    createOrUpdateScriptLauncherFromApi
};
