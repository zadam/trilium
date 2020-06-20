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

function createNote(parentNoteId, noteTitle) {
    return (noteService.createNewNote({
        parentNoteId: parentNoteId,
        title: noteTitle,
        content: '',
        isProtected: false,
        type: 'text'
    })).note;
}

function getNoteStartingWith(parentNoteId, startsWith) {
    return repository.getEntity(`SELECT notes.* FROM notes JOIN branches USING(noteId) 
                                    WHERE parentNoteId = ? AND title LIKE '${startsWith}%'
                                    AND notes.isDeleted = 0 AND isProtected = 0 
                                    AND branches.isDeleted = 0`, [parentNoteId]);
}

/** @return {Promise<Note>} */
function getRootCalendarNote() {
    // some caching here could be useful (e.g. in CLS)
    let rootNote = attributeService.getNoteWithLabel(CALENDAR_ROOT_LABEL);

    if (!rootNote) {
        rootNote = (noteService.createNewNote({
            parentNoteId: 'root',
            title: 'Calendar',
            target: 'into',
            isProtected: false,
            type: 'text',
            content: ''
        })).note;

        attributeService.createLabel(rootNote.noteId, CALENDAR_ROOT_LABEL);
        attributeService.createLabel(rootNote.noteId, 'sorted');
    }

    return rootNote;
}

/** @return {Promise<Note>} */
function getYearNote(dateStr, rootNote) {
    if (!rootNote) {
        rootNote = getRootCalendarNote();
    }

    const yearStr = dateStr.substr(0, 4);

    let yearNote = attributeService.getNoteWithLabel(YEAR_LABEL, yearStr);

    if (!yearNote) {
        yearNote = getNoteStartingWith(rootNote.noteId, yearStr);

        if (!yearNote) {
            yearNote = createNote(rootNote.noteId, yearStr);

            attributeService.createLabel(yearNote.noteId, YEAR_LABEL, yearStr);
            attributeService.createLabel(yearNote.noteId, 'sorted');

            const yearTemplateAttr = rootNote.getOwnedAttribute('relation', 'yearTemplate');

            if (yearTemplateAttr) {
                attributeService.createRelation(yearNote.noteId, 'template', yearTemplateAttr.value);
            }
        }
    }

    return yearNote;
}

function getMonthNoteTitle(rootNote, monthNumber, dateObj) {
    const pattern = rootNote.getOwnedLabelValue("monthPattern") || "{monthNumberPadded} - {month}";
    const monthName = MONTHS[dateObj.getMonth()];

    return pattern
        .replace(/{monthNumberPadded}/g, monthNumber)
        .replace(/{month}/g, monthName);
}

/** @return {Promise<Note>} */
function getMonthNote(dateStr, rootNote) {
    if (!rootNote) {
        rootNote = getRootCalendarNote();
    }

    const monthStr = dateStr.substr(0, 7);
    const monthNumber = dateStr.substr(5, 2);

    let monthNote = attributeService.getNoteWithLabel(MONTH_LABEL, monthStr);

    if (!monthNote) {
        const yearNote = getYearNote(dateStr, rootNote);

        monthNote = getNoteStartingWith(yearNote.noteId, monthNumber);

        if (!monthNote) {
            const dateObj = dateUtils.parseLocalDate(dateStr);

            const noteTitle = getMonthNoteTitle(rootNote, monthNumber, dateObj);

            monthNote = createNote(yearNote.noteId, noteTitle);

            attributeService.createLabel(monthNote.noteId, MONTH_LABEL, monthStr);
            attributeService.createLabel(monthNote.noteId, 'sorted');

            const monthTemplateAttr = rootNote.getOwnedAttribute('relation', 'monthTemplate');

            if (monthTemplateAttr) {
                attributeService.createRelation(monthNote.noteId, 'template', monthTemplateAttr.value);
            }
        }
    }

    return monthNote;
}

function getDateNoteTitle(rootNote, dayNumber, dateObj) {
    const pattern = rootNote.getOwnedLabelValue("datePattern") || "{dayInMonthPadded} - {weekDay}";
    const weekDay = DAYS[dateObj.getDay()];

    return pattern
        .replace(/{dayInMonthPadded}/g, dayNumber)
        .replace(/{weekDay}/g, weekDay)
        .replace(/{weekDay3}/g, weekDay.substr(0, 3))
        .replace(/{weekDay2}/g, weekDay.substr(0, 2));
}

/** @return {Promise<Note>} */
function getDateNote(dateStr) {
    const rootNote = getRootCalendarNote();

    const dayNumber = dateStr.substr(8, 2);

    let dateNote = attributeService.getNoteWithLabel(DATE_LABEL, dateStr);

    if (!dateNote) {
        const monthNote = getMonthNote(dateStr, rootNote);

        dateNote = getNoteStartingWith(monthNote.noteId, dayNumber);

        if (!dateNote) {
            const dateObj = dateUtils.parseLocalDate(dateStr);

            const noteTitle = getDateNoteTitle(rootNote, dayNumber, dateObj);

            dateNote = createNote(monthNote.noteId, noteTitle);

            attributeService.createLabel(dateNote.noteId, DATE_LABEL, dateStr.substr(0, 10));

            const dateTemplateAttr = rootNote.getOwnedAttribute('relation', 'dateTemplate');

            if (dateTemplateAttr) {
                attributeService.createRelation(dateNote.noteId, 'template', dateTemplateAttr.value);
            }
        }
    }

    return dateNote;
}

function getTodayNote() {
    return getDateNote(dateUtils.localNowDate());
}

function getStartOfTheWeek(date, startOfTheWeek) {
    const day = date.getDay();
    let diff;

    if (startOfTheWeek === 'monday') {
        diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    }
    else if (startOfTheWeek === 'sunday') {
        diff = date.getDate() - day;
    }
    else {
        throw new Error("Unrecognized start of the week " + startOfTheWeek);
    }

    return new Date(date.setDate(diff));
}

function getWeekNote(dateStr, options = {}) {
    const startOfTheWeek = options.startOfTheWeek || "monday";

    const dateObj = getStartOfTheWeek(dateUtils.parseLocalDate(dateStr), startOfTheWeek);

    dateStr = dateUtils.utcDateStr(dateObj);

    return getDateNote(dateStr);
}

module.exports = {
    getRootCalendarNote,
    getYearNote,
    getMonthNote,
    getWeekNote,
    getDateNote,
    getTodayNote
};
