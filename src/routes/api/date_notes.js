"use strict";

const dateNoteService = require('../../services/date_notes');
const sql = require('../../services/sql');
const dateUtils = require('../../services/date_utils');
const noteService = require('../../services/notes');
const attributeService = require('../../services/attributes');
const cls = require('../../services/cls');
const repository = require('../../services/repository');

function getInboxNote(req) {
    return attributeService.getNoteWithLabel('inbox')
        || dateNoteService.getDateNote(req.params.date);
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

function createSearchNote(req) {
    const params = req.body;
    const searchString = params.searchString || "";
    let ancestorNoteId = params.ancestorNoteId;

    const hoistedNote = cls.getHoistedNoteId() && cls.getHoistedNoteId() !== 'root'
        ? repository.getNote(cls.getHoistedNoteId())
        : null;

    let searchHome;

    if (hoistedNote) {
        ([searchHome] = hoistedNote.getDescendantNotesWithLabel('hoistedSearchHome'));
    }

    if (!searchHome) {
        const today = dateUtils.localNowDate();

        searchHome = attributeService.getNoteWithLabel('searchHome')
                  || dateNoteService.getDateNote(today);
    }

    if (hoistedNote) {

        if (!hoistedNote.getDescendantNoteIds().includes(searchHome.noteId)) {
            // otherwise the note would be saved outside of the hoisted context which is weird
            searchHome = hoistedNote;
        }

        if (!ancestorNoteId) {
            ancestorNoteId = hoistedNote.noteId;
        }
    }

    const {note} = noteService.createNewNote({
        parentNoteId: searchHome.noteId,
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

module.exports = {
    getInboxNote,
    getDateNote,
    getMonthNote,
    getYearNote,
    getDateNotesForMonth,
    createSqlConsole,
    createSearchNote
};
