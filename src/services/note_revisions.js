"use strict";

const NoteRevision = require('../becca/entities/note_revision');
const dateUtils = require('./date_utils');
const log = require('./log');
const sql = require('./sql');

/**
 * @param {Note} note
 */
function protectNoteRevisions(note) {
    for (const revision of note.getNoteRevisions()) {
        if (note.isProtected !== revision.isProtected) {
            try {
                const content = revision.getContent();

                revision.isProtected = note.isProtected;

                // this will force de/encryption
                revision.setContent(content);

                revision.save();
            }
            catch (e) {
                log.error("Could not un/protect note revision ID = " + revision.noteRevisionId);

                throw e;
            }
        }
    }
}

/**
 * @param {Note} note
 * @return {NoteRevision|null}
 */
function createNoteRevision(note) {
    if (note.hasLabel("disableVersioning")) {
        return null;
    }

    const content = note.getContent();

    if (!content || (Buffer.isBuffer(content) && content.byteLength === 0)) {
        return null;
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

    noteRevision.setContent(content);

    return noteRevision;
}

function eraseNoteRevisions(noteRevisionIdsToErase) {
    if (noteRevisionIdsToErase.length === 0) {
        return;
    }

    log.info(`Removing note revisions: ${JSON.stringify(noteRevisionIdsToErase)}`);

    sql.executeMany(`DELETE FROM note_revisions WHERE noteRevisionId IN (???)`, noteRevisionIdsToErase);
    sql.executeMany(`UPDATE entity_changes SET isErased = 1 WHERE entityName = 'note_revisions' AND entityId IN (???)`, noteRevisionIdsToErase);

    sql.executeMany(`DELETE FROM note_revision_contents WHERE noteRevisionId IN (???)`, noteRevisionIdsToErase);
    sql.executeMany(`UPDATE entity_changes SET isErased = 1 WHERE entityName = 'note_revision_contents' AND entityId IN (???)`, noteRevisionIdsToErase);
}

module.exports = {
    protectNoteRevisions,
    createNoteRevision,
    eraseNoteRevisions
};
