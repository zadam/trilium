const protectedSession = require("./protected_session.js");
const log = require("./log.js");

/**
 * @param {BNote} note
 */
function protectNoteAttachments(note) {
    for (const noteAttachment of note.getNoteAttachments()) {
        if (note.isProtected !== noteAttachment.isProtected) {
            if (!protectedSession.isProtectedSessionAvailable()) {
                log.error("Protected session is not available to fix note attachments.");

                return;
            }

            try {
                const content = noteAttachment.getContent();

                noteAttachment.isProtected = note.isProtected;

                // this will force de/encryption
                noteAttachment.setContent(content);

                noteAttachment.save();
            }
            catch (e) {
                log.error(`Could not un/protect note attachment ID = ${noteAttachment.noteAttachmentId}`);

                throw e;
            }
        }
    }
}

module.exports = {
    protectNoteAttachments
}
