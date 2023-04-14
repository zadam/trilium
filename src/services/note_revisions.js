"use strict";

const log = require('./log');
const sql = require('./sql');
const protectedSessionService = require("./protected_session");

/**
 * @param {BNote} note
 */
function protectNoteRevisions(note) {
    if (!protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot (un)protect revisions of note '${note.noteId}' without active protected session`);
    }

    for (const revision of note.getNoteRevisions()) {
        if (note.isProtected === revision.isProtected) {
            continue;
        }

        try {
            const content = revision.getContent();

            revision.isProtected = note.isProtected;

            // this will force de/encryption
            revision.setContent(content, {forceSave: true});
        } catch (e) {
            log.error(`Could not un/protect note revision '${revision.noteRevisionId}'`);

            throw e;
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
}

module.exports = {
    protectNoteRevisions,
    eraseNoteRevisions
};
