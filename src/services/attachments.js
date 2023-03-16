const protectedSession = require("./protected_session");
const log = require("./log");

/**
 * @param {BNote} note
 */
function protectAttachments(note) {
    for (const attachment of note.getAttachments()) {
        if (note.isProtected !== attachment.isProtected) {
            if (!protectedSession.isProtectedSessionAvailable()) {
                log.error("Protected session is not available to fix attachments.");

                return;
            }

            try {
                const content = attachment.getContent();

                attachment.isProtected = note.isProtected;

                // this will force de/encryption
                attachment.setContent(content);

                attachment.save();
            }
            catch (e) {
                log.error(`Could not un/protect attachment ID = ${attachment.attachmentId}`);

                throw e;
            }
        }
    }
}

module.exports = {
    protectAttachments
}
