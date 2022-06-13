"use strict";

const log = require('./log');
const sql = require('./sql');
const protectedSession = require("./protected_session");

/**
 * @param {Note} note
 */
function protectNoteRevisions(note) {
    for (const revision of note.getNoteRevisions()) {
        if (note.isProtected !== revision.isProtected) {
            if (!protectedSession.isProtectedSessionAvailable()) {
                log.error("Protected session is not available to fix note revisions.");

                return;
            }

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
    eraseNoteRevisions
};
