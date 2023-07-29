"use strict";

const log = require('./log');
const sql = require('./sql');
const protectedSessionService = require("./protected_session");
const dateUtils = require("./date_utils");

/**
 * @param {BNote} note
 */
function protectRevisions(note) {
    if (!protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot (un)protect revisions of note '${note.noteId}' without active protected session`);
    }

    for (const revision of note.getRevisions()) {
        if (note.isProtected === revision.isProtected) {
            continue;
        }

        try {
            const content = revision.getContent();

            revision.isProtected = note.isProtected;

            // this will force de/encryption
            revision.setContent(content, {forceSave: true});
        } catch (e) {
            log.error(`Could not un/protect note revision '${revision.revisionId}'`);

            throw e;
        }
    }
}

function eraseRevisions(revisionIdsToErase) {
    if (revisionIdsToErase.length === 0) {
        return;
    }

    log.info(`Removing note revisions: ${JSON.stringify(revisionIdsToErase)}`);

    sql.executeMany(`DELETE FROM revisions WHERE revisionId IN (???)`, revisionIdsToErase);
    sql.executeMany(`UPDATE entity_changes SET isErased = 1, utcDateChanged = '${dateUtils.utcNowDateTime()}' WHERE entityName = 'revisions' AND entityId IN (???)`, revisionIdsToErase);
}

module.exports = {
    protectRevisions,
    eraseRevisions
};
