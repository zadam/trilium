module.exports = () => {
    const beccaLoader = require('../../src/becca/becca_loader.js');
    const becca = require('../../src/becca/becca.js');
    const cls = require('../../src/services/cls.js');
    const log = require('../../src/services/log.js');
    const sql = require('../../src/services/sql.js');

    cls.init(() => {
        // emergency disabling of image compression since it appears to make problems in migration to 0.61
        sql.execute(`UPDATE options SET value = 'false' WHERE name = 'compressImages'`);

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
