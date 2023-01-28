module.exports = async () => {
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");
    const becca = require("../../src/becca/becca");
    const log = require("../../src/services/log");

    await cls.init(async () => {
        beccaLoader.load();

        for (const note of Object.values(becca.notes)) {
            if (note.type !== 'canvas') {
                continue;
            }

            if (note.isProtected) {
                // can't migrate protected notes, but that's not critical.
                continue;
            }

            const content = note.getContent(true);
            let svg;

            try {
                const payload = JSON.parse(content);
                svg = payload?.svg;

                if (!svg) {
                    continue;
                }
            }
            catch (e) {
                log.info(`Could not create a note ancillary for canvas "${note.noteId}" with error: ${e.message} ${e.stack}`);
                continue;
            }

            note.saveNoteAncillary('canvasSvg', 'image/svg+xml', svg);
        }
    });
};
