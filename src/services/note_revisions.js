"use strict";

const NoteRevision = require('../entities/note_revision');
const dateUtils = require('../services/date_utils');

/**
 * @param {Note} note
 */
function protectNoteRevisions(note) {
    for (const revision of note.getRevisions()) {
        if (note.isProtected !== revision.isProtected) {
            const content = revision.getContent();

            revision.isProtected = note.isProtected;

            // this will force de/encryption
            revision.setContent(content);

            revision.save();
        }
    }
}

/**
 * @param {Note} note
 * @return {NoteRevision}
 */
function createNoteRevision(note) {
    if (note.hasLabel("disableVersioning")) {
        return;
    }

    const contentMetadata = note.getContentMetadata();

    const noteRevision = new NoteRevision({
        noteId: note.noteId,
        // title and text should be decrypted now
        title: note.title,
        type: note.type,
        mime: note.mime,
        isProtected: false, // will be fixed in the protectNoteRevisions() call
        utcDateLastEdited: note.utcDateModified > contentMetadata.utcDateModified
            ? note.utcDateModified
            : contentMetadata.utcDateModified,
        utcDateCreated: dateUtils.utcNowDateTime(),
        utcDateModified: dateUtils.utcNowDateTime(),
        dateLastEdited: note.dateModified > contentMetadata.dateModified
            ? note.dateModified
            : contentMetadata.dateModified,
        dateCreated: dateUtils.localNowDateTime()
    }).save();

    noteRevision.setContent(note.getContent());

    return noteRevision;
}

module.exports = {
    protectNoteRevisions,
    createNoteRevision
};
