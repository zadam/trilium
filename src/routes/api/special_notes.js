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

function saveSqlConsole(req) {
    const sqlConsoleNote = becca.getNote(req.body.sqlConsoleNoteId);
    const today = dateUtils.localNowDate();

    const sqlConsoleHome =
        attributeService.getNoteWithLabel('sqlConsoleHome')
        || dateNoteService.getDateNote(today);

    return sqlConsoleNote.cloneTo(sqlConsoleHome.noteId);
}

function createSqlConsole() {
    const {note} = noteService.createNewNote({
        parentNoteId: getSqlConsoleRoot().noteId,
        title: 'SQL Console',
        content: "SELECT title, isDeleted, isProtected FROM notes WHERE noteId = ''\n\n\n\n",
        type: 'code',
        mime: 'text/x-sqlite;schema=trilium'
    });

    note.setLabel("sqlConsole", dateUtils.localNowDate());

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

        // isInheritable: false means that this notePath is automatically not preffered but at the same time
        // the flag is not inherited to the children
        hidden.addLabel('archived', "", false);
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

function getSpecialNoteRoot() {
    let specialNoteRoot = becca.getNote('special');

    if (!specialNoteRoot) {
        specialNoteRoot = noteService.createNewNote({
            noteId: 'special',
            title: 'special',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return specialNoteRoot;
}

function getGlobalLinkMapNote() {
    let globalLinkMapNote = becca.getNote('global-link-map');

    if (!globalLinkMapNote) {
        globalLinkMapNote = noteService.createNewNote({
            noteId: 'global-link-map',
            title: 'global-link-map',
            type: 'global-link-map',
            content: '',
            parentNoteId: getSpecialNoteRoot().noteId
        }).note;
    }

    return globalLinkMapNote;
}

function getSqlConsoleRoot() {
    let sqlConsoleRoot = becca.getNote('sqlconsole');

    if (!sqlConsoleRoot) {
        sqlConsoleRoot = noteService.createNewNote({
            noteId: 'sqlconsole',
            title: 'SQL Console',
            type: 'text',
            content: '',
            parentNoteId: getHiddenRoot().noteId
        }).note;
    }

    return sqlConsoleRoot;
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
    saveSqlConsole,
    createSearchNote,
    saveSearchNote
};
