"use strict";

const repository = require('../../services/repository');
const noteCacheService = require('../../services/note_cache/note_cache_service');
const protectedSessionService = require('../../services/protected_session');
const noteRevisionService = require('../../services/note_revisions');
const utils = require('../../services/utils');
const path = require('path');

function getNoteRevisions(req) {
    return repository.getEntities(`
        SELECT note_revisions.*,
               LENGTH(note_revision_contents.content) AS contentLength
        FROM note_revisions
        JOIN note_revision_contents ON note_revisions.noteRevisionId = note_revision_contents.noteRevisionId 
        WHERE noteId = ? 
          AND isErased = 0
        ORDER BY utcDateCreated DESC`, [req.params.noteId]);
}

function getNoteRevision(req) {
    const noteRevision = repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision.type === 'file') {
        if (noteRevision.isStringNote()) {
            noteRevision.content = (noteRevision.getContent()).substr(0, 10000);
        }
    }
    else {
        noteRevision.content = noteRevision.getContent();

        if (noteRevision.content && noteRevision.type === 'image') {
            noteRevision.content = noteRevision.content.toString('base64');
        }
    }

    return noteRevision;
}

/**
 * @param {NoteRevision} noteRevision
 * @return {string}
 */
function getRevisionFilename(noteRevision) {
    let filename = utils.formatDownloadTitle(noteRevision.title, noteRevision.type, noteRevision.mime);

    const extension = path.extname(filename);
    const date = noteRevision.dateCreated
        .substr(0, 19)
        .replace(' ', '_')
        .replace(/[^0-9_]/g, '');

    if (extension) {
        filename = filename.substr(0, filename.length - extension.length)
            + '-' + date + extension;
    }
    else {
        filename += '-' + date;
    }

    return filename;
}

function downloadNoteRevision(req, res) {
    const noteRevision = repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision.noteId !== req.params.noteId) {
        return res.status(400).send(`Note revision ${req.params.noteRevisionId} does not belong to note ${req.params.noteId}`);
    }

    if (noteRevision.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return res.status(401).send("Protected session not available");
    }

    const filename = getRevisionFilename(noteRevision);

    res.setHeader('Content-Disposition', utils.getContentDisposition(filename));
    res.setHeader('Content-Type', noteRevision.mime);

    res.send(noteRevision.getContent());
}

/**
 * @param {NoteRevision} noteRevision
 */
function eraseOneNoteRevision(noteRevision) {
    noteRevision.isErased = true;
    noteRevision.title = null;
    noteRevision.save();

    noteRevision.setContent(null);
}

function eraseAllNoteRevisions(req) {
    const noteRevisionsToErase = repository.getEntities(
        'SELECT * FROM note_revisions WHERE isErased = 0 AND noteId = ?',
        [req.params.noteId]);

    for (const noteRevision of noteRevisionsToErase) {
        eraseOneNoteRevision(noteRevision);
    }
}

function eraseNoteRevision(req) {
    const noteRevision = repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision && !noteRevision.isErased) {
        eraseOneNoteRevision(noteRevision);
    }
}

function restoreNoteRevision(req) {
    const noteRevision = repository.getNoteRevision(req.params.noteRevisionId);

    if (noteRevision && !noteRevision.isErased) {
        const note = noteRevision.getNote();

        noteRevisionService.createNoteRevision(note);

        note.title = noteRevision.title;
        note.setContent(noteRevision.getContent());
        note.save();
    }
}

function getEditedNotesOnDate(req) {
    const notes = repository.getEntities(`
        SELECT notes.*
        FROM notes
        WHERE noteId IN (
                SELECT noteId FROM notes 
                WHERE notes.dateCreated LIKE :date
                   OR notes.dateModified LIKE :date
            UNION ALL
                SELECT noteId FROM note_revisions
                WHERE note_revisions.dateLastEdited LIKE :date
        )
        ORDER BY isDeleted
        LIMIT 50`, {date: req.params.date + '%'});

    for (const note of notes) {
        const notePath = note.isDeleted ? null : noteCacheService.getNotePath(note.noteId);

        note.notePath = notePath ? notePath.notePath : null;
    }

    return notes;
}

module.exports = {
    getNoteRevisions,
    getNoteRevision,
    downloadNoteRevision,
    getEditedNotesOnDate,
    eraseAllNoteRevisions,
    eraseNoteRevision,
    restoreNoteRevision
};
