"use strict";

const sql = require('./sql');
const noteService = require('./notes');
const labelService = require('./labels');
const dateUtils = require('./date_utils');
const repository = require('./repository');

const CALENDAR_ROOT_LABEL = 'calendarRoot';
const YEAR_LABEL = 'yearNote';
const MONTH_LABEL = 'monthNote';
const DATE_LABEL = 'dateNote';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function createNote(parentNoteId, noteTitle, noteText) {
    return await noteService.createNewNote(parentNoteId, {
        title: noteTitle,
        content: noteText,
        target: 'into',
        isProtected: false
    });
}

async function getNoteStartingWith(parentNoteId, startsWith) {
    return await repository.getEntity(`SELECT notes.* FROM notes JOIN branches USING(noteId) 
                                    WHERE parentNoteId = ? AND title LIKE '${startsWith}%'
                                    AND notes.isDeleted = 0 AND isProtected = 0 
                                    AND branches.isDeleted = 0`, [parentNoteId]);
}

async function getRootCalendarNote() {
    let rootNote = await labelService.getNoteWithLabel(CALENDAR_ROOT_LABEL);

    if (!rootNote) {
        rootNote = (await noteService.createNewNote('root', {
            title: 'Calendar',
            target: 'into',
            isProtected: false
        })).note;

        await labelService.createLabel(rootNote.noteId, CALENDAR_ROOT_LABEL);
    }

    return rootNote;
}

async function getYearNote(dateTimeStr, rootNote) {
    const yearStr = dateTimeStr.substr(0, 4);

    let yearNote = await labelService.getNoteWithLabel(YEAR_LABEL, yearStr);

    if (!yearNote) {
        yearNote = await getNoteStartingWith(rootNote.noteId, yearStr);

        if (!yearNote) {
            yearNote = await createNote(rootNote.noteId, yearStr);
        }

        await labelService.createLabel(yearNote.noteId, YEAR_LABEL, yearStr);
    }

    return yearNote;
}

async function getMonthNote(dateTimeStr, rootNote) {
    const monthStr = dateTimeStr.substr(0, 7);
    const monthNumber = dateTimeStr.substr(5, 2);

    let monthNote = await labelService.getNoteWithLabel(MONTH_LABEL, monthStr);

    if (!monthNote) {
        const yearNote = await getYearNote(dateTimeStr, rootNote);

        monthNote = await getNoteStartingWith(yearNote.noteId, monthNumber);

        if (!monthNote) {
            const dateObj = dateUtils.parseDate(dateTimeStr);

            const noteTitle = monthNumber + " - " + MONTHS[dateObj.getMonth()];

            monthNote = await createNote(yearNote.noteId, noteTitle);
        }

        await labelService.createLabel(monthNote.noteId, MONTH_LABEL, monthStr);
    }

    return monthNote;
}

async function getDateNote(dateTimeStr, rootNote = null) {
    if (!rootNote) {
        rootNote = await getRootCalendarNote();
    }

    const dateStr = dateTimeStr.substr(0, 10);
    const dayNumber = dateTimeStr.substr(8, 2);

    let dateNote = await labelService.getNoteWithLabel(DATE_LABEL, dateStr);

    if (!dateNote) {
        const monthNote = await getMonthNote(dateTimeStr, rootNote);

        dateNote = await getNoteStartingWith(monthNote.noteId, dayNumber);

        if (!dateNote) {
            const dateObj = dateUtils.parseDate(dateTimeStr);

            const noteTitle = dayNumber + " - " + DAYS[dateObj.getDay()];

            dateNote = await createNote(monthNote.noteId, noteTitle);
        }

        await labelService.createLabel(dateNote.noteId, DATE_LABEL, dateStr);
    }

    return dateNote;
}

module.exports = {
    getRootCalendarNote,
    getYearNote,
    getMonthNote,
    getDateNote
};