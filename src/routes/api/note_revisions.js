"use strict";

const repository = require('../../services/repository');
const noteCacheService = require('../../services/note_cache');

async function getNoteRevisions(req) {
    const {noteId} = req.params;

    return await repository.getEntities(`
        SELECT note_revisions.*
        FROM note_revisions 
        WHERE noteId = ? 
        ORDER BY utcDateCreated DESC`, [noteId]);
}

async function getNoteRevision(req) {
    const noteRevision = await repository.getNoteRevision(req.params.noteRevisionId);

    await noteRevision.getContent();

    return noteRevision;
}

async function getEditedNotesOnDate(req) {
    const date = req.params.date;

    const notes = await repository.getEntities(`
        select distinct notes.*
        from notes
        left join note_revisions using (noteId)
        where substr(notes.dateCreated, 0, 11) = ?
           or substr(notes.dateModified, 0, 11) = ?
           or substr(note_revisions.dateLastEdited, 0, 11) = ?`, [date, date, date]);

    for (const note of notes) {
        const notePath = noteCacheService.getNotePath(note.noteId);

        note.notePath = notePath ? notePath.notePath : null;
    }

    return notes;
}

module.exports = {
    getNoteRevisions,
    getNoteRevision,
    getEditedNotesOnDate
};