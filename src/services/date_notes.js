"use strict";

const sql = require('./sql');
const noteService = require('./notes');
const labelService = require('./labels');
const dateUtils = require('./date_utils');

const CALENDAR_ROOT_LABEL = 'calendar_root';
const YEAR_LABEL = 'year_note';
const MONTH_LABEL = 'month_note';
const DATE_LABEL = 'date_note';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

async function createNote(parentNoteId, noteTitle, noteText) {
    const {note} = await noteService.createNewNote(parentNoteId, {
        title: noteTitle,
        content: noteText,
        target: 'into',
        isProtected: false
    });

    return note.noteId;
}

async function getNoteStartingWith(parentNoteId, startsWith) {
    return await sql.getValue(`SELECT noteId FROM notes JOIN branches USING(noteId) 
                                    WHERE parentNoteId = ? AND title LIKE '${startsWith}%'
                                    AND notes.isDeleted = 0 AND isProtected = 0 
                                    AND branches.isDeleted = 0`, [parentNoteId]);
}

async function getRootCalendarNoteId() {
    let rootNoteId = await sql.getValue(`SELECT notes.noteId FROM notes JOIN labels USING(noteId) 
              WHERE labels.name = '${CALENDAR_ROOT_LABEL}' AND notes.isDeleted = 0`);

    if (!rootNoteId) {
        const {rootNote} = await noteService.createNewNote('root', {
            title: 'Calendar',
            target: 'into',
            isProtected: false
        });

        const rootNoteId = rootNote.noteId;

        await labelService.createLabel(rootNoteId, CALENDAR_ROOT_LABEL);
    }

    return rootNoteId;
}

async function getYearNoteId(dateTimeStr, rootNoteId) {
    const yearStr = dateTimeStr.substr(0, 4);

    let yearNoteId = await labelService.getNoteIdWithLabel(YEAR_LABEL, yearStr);

    if (!yearNoteId) {
        yearNoteId = await getNoteStartingWith(rootNoteId, yearStr);

        if (!yearNoteId) {
            yearNoteId = await createNote(rootNoteId, yearStr);
        }

        await labelService.createLabel(yearNoteId, YEAR_LABEL, yearStr);
    }

    return yearNoteId;
}

async function getMonthNoteId(dateTimeStr, rootNoteId) {
    const monthStr = dateTimeStr.substr(0, 7);
    const monthNumber = dateTimeStr.substr(5, 2);

    let monthNoteId = await labelService.getNoteIdWithLabel(MONTH_LABEL, monthStr);

    if (!monthNoteId) {
        const yearNoteId = await getYearNoteId(dateTimeStr, rootNoteId);

        monthNoteId = await getNoteStartingWith(yearNoteId, monthNumber);

        if (!monthNoteId) {
            const dateObj = dateUtils.parseDate(dateTimeStr);

            const noteTitle = monthNumber + " - " + MONTHS[dateObj.getMonth()];

            monthNoteId = await createNote(yearNoteId, noteTitle);
        }

        await labelService.createLabel(monthNoteId, MONTH_LABEL, monthStr);
    }

    return monthNoteId;
}

async function getDateNoteId(dateTimeStr, rootNoteId = null) {
    if (!rootNoteId) {
        rootNoteId = await getRootCalendarNoteId();
    }

    const dateStr = dateTimeStr.substr(0, 10);
    const dayNumber = dateTimeStr.substr(8, 2);

    let dateNoteId = await labelService.getNoteIdWithLabel(DATE_LABEL, dateStr);

    if (!dateNoteId) {
        const monthNoteId = await getMonthNoteId(dateTimeStr, rootNoteId);

        dateNoteId = await getNoteStartingWith(monthNoteId, dayNumber);

        if (!dateNoteId) {
            const dateObj = dateUtils.parseDate(dateTimeStr);

            const noteTitle = dayNumber + " - " + DAYS[dateObj.getDay()];

            dateNoteId = await createNote(monthNoteId, noteTitle);
        }

        await labelService.createLabel(dateNoteId, DATE_LABEL, dateStr);
    }

    return dateNoteId;
}

module.exports = {
    getRootCalendarNoteId,
    getYearNoteId,
    getMonthNoteId,
    getDateNoteId
};