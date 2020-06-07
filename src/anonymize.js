const backupService = require('./services/backup');
const sqlInit = require('./services/sql_init');
require('./entities/entity_constructor');

sqlInit.dbReady.then(async () => {
    try {
        console.log("Starting anonymization...");

        const resp = await backupService.anonymize();

        if (resp.success) {
            console.log("Anonymized file has been saved to: " + resp.anonymizedFilePath);

            process.exit(0);
        } else {
            console.log("Anonymization failed.");
        }
    }
    catch (e) {
        console.error(e.message, e.stack);
    }

    process.exit(1);
});
