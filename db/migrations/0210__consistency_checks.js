module.exports = async () => {
    const cls = require("../../src/services/cls");
    const beccaLoader = require("../../src/becca/becca_loader");
    const log = require("../../src/services/log");
    const consistencyChecks = require("../../src/services/consistency_checks");
    const noteService = require("../../src/services/notes");

    await cls.init(async () => {
        // precaution for the 0211 migration
        noteService.eraseDeletedNotesNow();

        beccaLoader.load();

        try {
            // precaution before running 211 which might produce unique constraint problems if the DB was not consistent
            consistencyChecks.runOnDemandChecksWithoutExclusiveLock(true);
        }
        catch (e) {
            // consistency checks might start failing in the future if there's some incompatible migration down the road
            // we can optimistically assume the DB is consistent and still continue
            log.error(`Consistency checks failed in migration 0210: ${e.message} ${e.stack}`);
        }
    });
};
