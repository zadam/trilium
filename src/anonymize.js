const anonymizationService = require('./services/anonymization.js');
const sqlInit = require('./services/sql_init.js');
require('./becca/entity_constructor.js');

sqlInit.dbReady.then(async () => {
    try {
        console.log("Starting anonymization...");

        const resp = await anonymizationService.createAnonymizedCopy('full');

        if (resp.success) {
            console.log(`Anonymized file has been saved to: ${resp.anonymizedFilePath}`);

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
