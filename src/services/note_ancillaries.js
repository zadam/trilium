const protectedSession = require("./protected_session.js");
const log = require("./log.js");

/**
 * @param {BNote} note
 */
function protectNoteAncillaries(note) {
    for (const noteAncillary of note.getNoteAncillaries()) {
        if (note.isProtected !== noteAncillary.isProtected) {
            if (!protectedSession.isProtectedSessionAvailable()) {
                log.error("Protected session is not available to fix note ancillaries.");

                return;
            }

            try {
                const content = noteAncillary.getContent();

                noteAncillary.isProtected = note.isProtected;

                // this will force de/encryption
                noteAncillary.setContent(content);

                noteAncillary.save();
            }
            catch (e) {
                log.error(`Could not un/protect note ancillary ID = ${noteAncillary.noteAncillaryId}`);

                throw e;
            }
        }
    }
}

module.exports = {
    protectNoteAncillaries
}
