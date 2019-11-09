"use strict";

const NoteRevision = require('../entities/note_revision');
const dateUtils = require('../services/date_utils');

/**
 * @param {Note} note
 */
async function protectNoteRevisions(note) {
    for (const revision of await note.getRevisions()) {
        if (note.isProtected !== revision.isProtected) {
            revision.isProtected = note.isProtected;

            await revision.save();
        }
    }
}

/**
 * @param {Note} note
 * @return {NoteRevision}
 */
async function createNoteRevision(note) {
    const noteRevision = await new NoteRevision({
        noteId: note.noteId,
        // title and text should be decrypted now
        title: note.title,
        contentLength: -1, // will be updated in .setContent()
        type: note.type,
        mime: note.mime,
        isProtected: false, // will be fixed in the protectNoteRevisions() call
        utcDateLastEdited: note.utcDateModified,
        utcDateCreated: dateUtils.utcNowDateTime(),
        utcDateModified: dateUtils.utcNowDateTime(),
        dateLastEdited: note.dateModified,
        dateCreated: dateUtils.localNowDateTime()
    }).save();

    await noteRevision.setContent(await note.getContent());

    return noteRevision;
}

module.exports = {
    protectNoteRevisions,
    createNoteRevision
};