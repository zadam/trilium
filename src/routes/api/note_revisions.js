"use strict";

const repository = require('../../services/repository');
const noteCacheService = require('../../services/note_cache');

async function getNoteRevisions(req) {
    const noteId = req.params.noteId;

    return await repository.getEntities(`
        SELECT note_revisions.*
        FROM note_revisions 
        WHERE noteId = ? 
        ORDER BY utcDateModifiedTo DESC`, [noteId]);
}

async function getNoteRevisionList(req) {
    const noteId = req.params.noteId;

    return await repository.getEntities(`
        SELECT noteRevisionId,
               noteId,
               title,
               isProtected,
               utcDateModifiedFrom,
               utcDateModifiedTo,
               dateModifiedFrom,
               dateModifiedTo,
               type,
               mime,
               CASE isProtected WHEN 1 THEN null ELSE LENGTH(content) END AS contentLength
        FROM note_revisions 
        WHERE noteId = ? 
        ORDER BY utcDateModifiedTo DESC`, [noteId]);
}

async function getEditedNotesOnDate(req) {
    const date = req.params.date;

    const notes = await repository.getEntities(`
        select distinct notes.*
        from notes
        left join note_revisions using (noteId)
        where substr(notes.dateCreated, 0, 11) = ?
           or substr(notes.dateModified, 0, 11) = ?
           or substr(note_revisions.dateModifiedFrom, 0, 11) = ?`, [date, date, date]);

    for (const note of notes) {
        const notePath = noteCacheService.getNotePath(note.noteId);

        note.notePath = notePath ? notePath.notePath : null;
    }

    return notes;
}

module.exports = {
    getNoteRevisions,
    getNoteRevisionList,
    getEditedNotesOnDate
};