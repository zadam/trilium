module.exports = () => {
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");
    const cls = require("../../src/services/cls");
    const log = require("../../src/services/log");

    cls.init(() => {
        beccaLoader.load();

        for (const note of Object.values(becca.notes)) {
            try {
                const attachment = note.convertToParentAttachment({autoConversion: true});

                if (attachment) {
                    log.info(`Auto-converted note '${note.noteId}' into attachment '${attachment.attachmentId}'.`);
                }
            }
            catch (e) {
                log.error(`Cannot convert note '${note.noteId}' to attachment: ${e.message} ${e.stack}`);
            }
        }
    });
};
