const anonymizationService = require('./services/anonymization');

anonymizationService.anonymize().then(filePath => {
    console.log("Anonymized file has been saved to:", filePath);

    process.exit(0);
});