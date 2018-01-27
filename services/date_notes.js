"use strict";

const sql = require('./sql');
const notes = require('./notes');
const attributes = require('./attributes');

const CALENDAR_ROOT_ATTRIBUTE = 'calendar_root';
const YEAR_ATTRIBUTE = 'year_note';
const MONTH_ATTRIBUTE = 'month_note';
const DATE_ATTRIBUTE = 'date_note';

async function createNote(parentNoteId, noteTitle, noteText) {
    return (await notes.createNewNote(parentNoteId, {
        note_title: noteTitle,
        note_text: noteText,
        target: 'into',
        is_protected: false
    })).noteId;
}

async function getNoteStartingWith(parentNoteId, startsWith) {
    return await sql.getFirstValue(`SELECT note_id FROM notes JOIN notes_tree USING(note_id) 
                                    WHERE parent_note_id = ? AND note_title LIKE '${startsWith}%'
                                    AND notes.is_deleted = 0 AND is_protected = 0 
                                    AND notes_tree.is_deleted = 0`, [parentNoteId]);
}

async function getRootNoteId() {
    let rootNoteId = await sql.getFirstValue(`SELECT notes.note_id FROM notes JOIN attributes USING(note_id) 
              WHERE attributes.name = '${CALENDAR_ROOT_ATTRIBUTE}' AND notes.is_deleted = 0`);

    if (!rootNoteId) {
        rootNoteId = (await notes.createNewNote('root', {
            note_title: 'Calendar',
            target: 'into',
            is_protected: false
        })).noteId;

        await attributes.createAttribute(rootNoteId, CALENDAR_ROOT_ATTRIBUTE);
    }

    return rootNoteId;
}

async function getYearNoteId(dateTimeStr, rootNoteId) {
    const yearStr = dateTimeStr.substr(0, 4);

    let yearNoteId = await attributes.getNoteIdWithAttribute(YEAR_ATTRIBUTE, yearStr);

    if (!yearNoteId) {
        yearNoteId = await getNoteStartingWith(rootNoteId, yearStr);

        if (!yearNoteId) {
            yearNoteId = await createNote(rootNoteId, yearStr);
        }

        await attributes.createAttribute(yearNoteId, YEAR_ATTRIBUTE, yearStr);
    }

    return yearNoteId;
}

async function getMonthNoteId(dateTimeStr, rootNoteId) {
    const monthStr = dateTimeStr.substr(0, 7);
    const monthNumber = dateTimeStr.substr(5, 2);

    let monthNoteId = await attributes.getNoteIdWithAttribute(MONTH_ATTRIBUTE, monthStr);

    if (!monthNoteId) {
        const yearNoteId = await getYearNoteId(dateTimeStr, rootNoteId);

        monthNoteId = await getNoteStartingWith(yearNoteId, monthNumber);

        if (!monthNoteId) {
            monthNoteId = await createNote(yearNoteId, monthNumber);
        }

        await attributes.createAttribute(monthNoteId, MONTH_ATTRIBUTE, monthStr);
    }

    return monthNoteId;
}

async function getDateNoteId(dateTimeStr, rootNoteId = null) {
    if (!rootNoteId) {
        rootNoteId = await getRootNoteId();
    }

    const dateStr = dateTimeStr.substr(0, 10);
    const dayNumber = dateTimeStr.substr(8, 2);

    let dateNoteId = await attributes.getNoteIdWithAttribute(DATE_ATTRIBUTE, dateStr);

    if (!dateNoteId) {
        const monthNoteId = await getMonthNoteId(dateTimeStr, rootNoteId);

        dateNoteId = await getNoteStartingWith(monthNoteId, dayNumber);

        if (!dateNoteId) {
            dateNoteId = await createNote(monthNoteId, dayNumber);
        }

        await attributes.createAttribute(dateNoteId, DATE_ATTRIBUTE, dateStr);
    }

    return dateNoteId;
}

module.exports = {
    getRootNoteId,
    getYearNoteId,
    getMonthNoteId,
    getDateNoteId
};