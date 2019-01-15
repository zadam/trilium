"use strict";

const noteService = require('./notes');
const attributeService = require('./attributes');
const dateUtils = require('./date_utils');
const repository = require('./repository');

const CALENDAR_ROOT_LABEL = 'calendarRoot';
const YEAR_LABEL = 'yearNote';
const MONTH_LABEL = 'monthNote';
const DATE_LABEL = 'dateNote';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function createNote(parentNoteId, noteTitle, noteText) {
    return (await noteService.createNewNote(parentNoteId, {
        title: noteTitle,
        content: noteText,
        target: 'into',
        isProtected: false
    })).note;
}

async function getNoteStartingWith(parentNoteId, startsWith) {
    return await repository.getEntity(`SELECT notes.* FROM notes JOIN branches USING(noteId) 
                                    WHERE parentNoteId = ? AND title LIKE '${startsWith}%'
                                    AND notes.isDeleted = 0 AND isProtected = 0 
                                    AND branches.isDeleted = 0`, [parentNoteId]);
}

async function getRootCalendarNote() {
    // some caching here could be useful (e.g. in CLS)
    let rootNote = await attributeService.getNoteWithLabel(CALENDAR_ROOT_LABEL);

    if (!rootNote) {
        rootNote = (await noteService.createNewNote('root', {
            title: 'Calendar',
            target: 'into',
            isProtected: false
        })).note;

        await attributeService.createLabel(rootNote.noteId, CALENDAR_ROOT_LABEL);
        await attributeService.createLabel(rootNote.noteId, 'sorted');
    }

    return rootNote;
}

async function getYearNote(dateStr, rootNote) {
    const yearStr = dateStr.substr(0, 4);

    let yearNote = await attributeService.getNoteWithLabel(YEAR_LABEL, yearStr);

    if (!yearNote) {
        yearNote = await getNoteStartingWith(rootNote.noteId, yearStr);

        if (!yearNote) {
            yearNote = await createNote(rootNote.noteId, yearStr);
        }

        await attributeService.createLabel(yearNote.noteId, YEAR_LABEL, yearStr);
        await attributeService.createLabel(yearNote.noteId, 'sorted');
    }

    return yearNote;
}

async function getMonthNote(dateStr, rootNote) {
    const monthStr = dateStr.substr(0, 7);
    const monthNumber = dateStr.substr(5, 2);

    let monthNote = await attributeService.getNoteWithLabel(MONTH_LABEL, monthStr);

    if (!monthNote) {
        const yearNote = await getYearNote(dateStr, rootNote);

        monthNote = await getNoteStartingWith(yearNote.noteId, monthNumber);

        if (!monthNote) {
            const dateObj = dateUtils.parseLocalDate(dateStr);

            const noteTitle = monthNumber + " - " + MONTHS[dateObj.getMonth()];

            monthNote = await createNote(yearNote.noteId, noteTitle);
        }

        await attributeService.createLabel(monthNote.noteId, MONTH_LABEL, monthStr);
        await attributeService.createLabel(monthNote.noteId, 'sorted');
    }

    return monthNote;
}

async function getDateNote(dateStr) {
    const rootNote = await getRootCalendarNote();

    const dayNumber = dateStr.substr(8, 2);

    let dateNote = await attributeService.getNoteWithLabel(DATE_LABEL, dateStr);

    if (!dateNote) {
        const monthNote = await getMonthNote(dateStr, rootNote);

        dateNote = await getNoteStartingWith(monthNote.noteId, dayNumber);

        if (!dateNote) {
            const dateObj = dateUtils.parseLocalDate(dateStr);

            const noteTitle = dayNumber + " - " + DAYS[dateObj.getDay()];

            dateNote = await createNote(monthNote.noteId, noteTitle);
        }

        await attributeService.createLabel(dateNote.noteId, DATE_LABEL, dateStr);
    }

    return dateNote;
}

module.exports = {
    getRootCalendarNote,
    getYearNote,
    getMonthNote,
    getDateNote
};