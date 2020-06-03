const backupService = require('./services/backup');

backupService.anonymize().then(resp => {
    if (resp.success) {
        console.log("Anonymization failed.");
    }
    else {
        console.log("Anonymized file has been saved to: " + resp.anonymizedFilePath);
    }

    process.exit(0);
});
