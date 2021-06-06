"use strict";

const dateNoteService = require('../../services/date_notes');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const noteService = require('../../services/notes');
const attributeService = require('../../services/attributes');
const cls = require('../../services/cls');
const becca = require('../../becca/becca');

function getInboxNote(req) {
    const hoistedNote = getHoistedNote();

    let inbox;

    if (!hoistedNote.isRoot()) {
        inbox = hoistedNote.searchNoteInSubtree('#hoistedInbox');

        if (!inbox) {
            inbox = hoistedNote.searchNoteInSubtree('#inbox');
        }

        if (!inbox) {
            inbox = hoistedNote;
        }
    }
    else {
        inbox = attributeService.getNoteWithLabel('inbox')
            || dateNoteService.getDateNote(req.params.date);
    }

    return inbox;
}

function getDateNote(req) {
    return dateNoteService.getDateNote(req.params.date);
}

function getMonthNote(req) {
    return dateNoteService.getMonthNote(req.params.month);
}

function getYearNote(req) {
    return dateNoteService.getYearNote(req.params.year);
}

function getDateNotesForMonth(req) {
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

function createSqlConsole() {
    const today = dateUtils.localNowDate();

    const sqlConsoleHome =
        attributeService.getNoteWithLabel('sqlConsoleHome')
        || dateNoteService.getDateNote(today);

    const {note} = noteService.createNewNote({
        parentNoteId: sqlConsoleHome.noteId,
        title: 'SQL Console',
        content: "SELECT title, isDeleted, isProtected FROM notes WHERE noteId = ''\n\n\n\n",
        type: 'code',
        mime: 'text/x-sqlite;schema=trilium'
    });

    note.setLabel("sqlConsole", today);

    return note;
}

function getHiddenRoot() {
    let hidden = becca.getNote('hidden');

    if (!hidden) {
        hidden = noteService.createNewNote({
            noteId: 'hidden',
            title: 'hidden',
            type: 'text',
            content: '',
            parentNoteId: 'root'
        }).note;

        hidden.addLabel('archived', "", true);
    }

    return hidden;
}

function getSearchRoot() {
    let searchRoot = becca.getNote('search');

    if (!searchRoot) {
        searchRoot = noteService.createNewNote({
            noteId: 'search',
            title: 'search',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return searchRoot;
}

function saveSearchNote(req) {
    const searchNote = becca.getNote(req.body.searchNoteId);

    const hoistedNote = getHoistedNote();
    let searchHome;

    if (!hoistedNote.isRoot()) {
        searchHome = hoistedNote.searchNoteInSubtree('#hoistedSearchHome')
            || hoistedNote.searchNoteInSubtree('#searchHome')
            || hoistedNote;
    }
    else {
        const today = dateUtils.localNowDate();

        searchHome = hoistedNote.searchNoteInSubtree('#searchHome')
            || dateNoteService.getDateNote(today);
    }

    return searchNote.cloneTo(searchHome.noteId);
}

function createSearchNote(req) {
    const params = req.body;
    const searchString = params.searchString || "";
    const hoistedNote = getHoistedNote();
    const ancestorNoteId = params.ancestorNoteId || hoistedNote.noteId;

    const {note} = noteService.createNewNote({
        parentNoteId: getSearchRoot().noteId,
        title: 'Search: ' + searchString,
        content: "",
        type: 'search',
        mime: 'application/json'
    });

    note.setLabel('searchString', searchString);

    if (ancestorNoteId) {
        note.setRelation('ancestor', ancestorNoteId);
    }

    return note;
}

function getHoistedNote() {
    return becca.getNote(cls.getHoistedNoteId());
}

module.exports = {
    getInboxNote,
    getDateNote,
    getMonthNote,
    getYearNote,
    getDateNotesForMonth,
    createSqlConsole,
    createSearchNote,
    saveSearchNote
};
