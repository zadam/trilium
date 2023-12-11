"use strict";

const log = require('./log.js');
const sql = require('./sql.js');
const protectedSessionService = require('./protected_session.js');
const dateUtils = require('./date_utils.js');

/**
 * @param {BNote} note
 */
function protectRevisions(note) {
    if (!protectedSessionService.isProtectedSessionAvailable()) {
        throw new Error(`Cannot (un)protect revisions of note '${note.noteId}' without active protected session`);
    }

    for (const revision of note.getRevisions()) {
        if (note.isProtected !== revision.isProtected) {
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

        for (const attachment of revision.getAttachments()) {
            if (note.isProtected !== attachment.isProtected) {
                try {
                    const content = attachment.getContent();

                    attachment.isProtected = note.isProtected;
                    attachment.setContent(content, {forceSave: true});
                } catch (e) {
                    log.error(`Could not un/protect attachment '${attachment.attachmentId}'`);

                    throw e;
                }
            }
        }
    }
}

module.exports = {
    protectRevisions
};
