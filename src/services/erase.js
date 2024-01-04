const sql = require("./sql.js");
const revisionService = require("./revisions.js");
const log = require("./log.js");
const entityChangesService = require("./entity_changes.js");
const optionService = require("./options.js");
const dateUtils = require("./date_utils.js");
const sqlInit = require("./sql_init.js");
const cls = require("./cls.js");

function eraseNotes(noteIdsToErase) {
    if (noteIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM notes WHERE noteId IN (???)`, noteIdsToErase);
    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'notes' AND entityId IN (???)`, noteIdsToErase));

    // we also need to erase all "dependent" entities of the erased notes
    const branchIdsToErase = sql.getManyRows(`SELECT branchId FROM branches WHERE noteId IN (???)`, noteIdsToErase)
        .map(row => row.branchId);

    eraseBranches(branchIdsToErase);

    const attributeIdsToErase = sql.getManyRows(`SELECT attributeId FROM attributes WHERE noteId IN (???)`, noteIdsToErase)
        .map(row => row.attributeId);

    eraseAttributes(attributeIdsToErase);

    const revisionIdsToErase = sql.getManyRows(`SELECT revisionId FROM revisions WHERE noteId IN (???)`, noteIdsToErase)
        .map(row => row.revisionId);

    eraseRevisions(revisionIdsToErase);

    log.info(`Erased notes: ${JSON.stringify(noteIdsToErase)}`);
}

function setEntityChangesAsErased(entityChanges) {
    for (const ec of entityChanges) {
        ec.isErased = true;
        // we're not changing hash here, not sure if good or not
        // content hash check takes isErased flag into account, though
        ec.utcDateChanged = dateUtils.utcNowDateTime();

        entityChangesService.putEntityChangeWithForcedChange(ec);
    }
}

function eraseBranches(branchIdsToErase) {
    if (branchIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM branches WHERE branchId IN (???)`, branchIdsToErase);

    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'branches' AND entityId IN (???)`, branchIdsToErase));

    log.info(`Erased branches: ${JSON.stringify(branchIdsToErase)}`);
}

function eraseAttributes(attributeIdsToErase) {
    if (attributeIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM attributes WHERE attributeId IN (???)`, attributeIdsToErase);

    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'attributes' AND entityId IN (???)`, attributeIdsToErase));

    log.info(`Erased attributes: ${JSON.stringify(attributeIdsToErase)}`);
}

function eraseAttachments(attachmentIdsToErase) {
    if (attachmentIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM attachments WHERE attachmentId IN (???)`, attachmentIdsToErase);

    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'attachments' AND entityId IN (???)`, attachmentIdsToErase));

    log.info(`Erased attachments: ${JSON.stringify(attachmentIdsToErase)}`);
}

function eraseRevisions(revisionIdsToErase) {
    if (revisionIdsToErase.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM revisions WHERE revisionId IN (???)`, revisionIdsToErase);

    setEntityChangesAsErased(sql.getManyRows(`SELECT * FROM entity_changes WHERE entityName = 'revisions' AND entityId IN (???)`, revisionIdsToErase));

    log.info(`Removed revisions: ${JSON.stringify(revisionIdsToErase)}`);
}

function eraseUnusedBlobs() {
    const unusedBlobIds = sql.getColumn(`
        SELECT blobs.blobId
        FROM blobs
        LEFT JOIN notes ON notes.blobId = blobs.blobId
        LEFT JOIN attachments ON attachments.blobId = blobs.blobId
        LEFT JOIN revisions ON revisions.blobId = blobs.blobId
        WHERE notes.noteId IS NULL 
          AND attachments.attachmentId IS NULL
          AND revisions.revisionId IS NULL`);

    if (unusedBlobIds.length === 0) {
        return;
    }

    sql.executeMany(`DELETE FROM blobs WHERE blobId IN (???)`, unusedBlobIds);
    // blobs are not marked as erased in entity_changes, they are just purged completely
    // this is because technically every keystroke can create a new blob and there would be just too many
    sql.executeMany(`DELETE FROM entity_changes WHERE entityName = 'blobs' AND entityId IN (???)`, unusedBlobIds);

    log.info(`Erased unused blobs: ${JSON.stringify(unusedBlobIds)}`);
}

function eraseDeletedEntities(eraseEntitiesAfterTimeInSeconds = null) {
    // this is important also so that the erased entity changes are sent to the connected clients
    sql.transactional(() => {
        if (eraseEntitiesAfterTimeInSeconds === null) {
            eraseEntitiesAfterTimeInSeconds = optionService.getOptionInt('eraseEntitiesAfterTimeInSeconds');
        }

        const cutoffDate = new Date(Date.now() - eraseEntitiesAfterTimeInSeconds * 1000);

        const noteIdsToErase = sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseNotes(noteIdsToErase);

        const branchIdsToErase = sql.getColumn("SELECT branchId FROM branches WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseBranches(branchIdsToErase);

        const attributeIdsToErase = sql.getColumn("SELECT attributeId FROM attributes WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseAttributes(attributeIdsToErase);

        const attachmentIdsToErase = sql.getColumn("SELECT attachmentId FROM attachments WHERE isDeleted = 1 AND utcDateModified <= ?", [dateUtils.utcDateTimeStr(cutoffDate)]);

        eraseAttachments(attachmentIdsToErase);

        eraseUnusedBlobs();
    });
}

function eraseNotesWithDeleteId(deleteId) {
    const noteIdsToErase = sql.getColumn("SELECT noteId FROM notes WHERE isDeleted = 1 AND deleteId = ?", [deleteId]);

    eraseNotes(noteIdsToErase);

    const branchIdsToErase = sql.getColumn("SELECT branchId FROM branches WHERE isDeleted = 1 AND deleteId = ?", [deleteId]);

    eraseBranches(branchIdsToErase);

    const attributeIdsToErase = sql.getColumn("SELECT attributeId FROM attributes WHERE isDeleted = 1 AND deleteId = ?", [deleteId]);

    eraseAttributes(attributeIdsToErase);

    const attachmentIdsToErase = sql.getColumn("SELECT attachmentId FROM attachments WHERE isDeleted = 1 AND deleteId = ?", [deleteId]);

    eraseAttachments(attachmentIdsToErase);

    eraseUnusedBlobs();
}

function eraseDeletedNotesNow() {
    eraseDeletedEntities(0);
}

function eraseUnusedAttachmentsNow() {
    eraseScheduledAttachments(0);
}

function eraseScheduledAttachments(eraseUnusedAttachmentsAfterSeconds = null) {
    if (eraseUnusedAttachmentsAfterSeconds === null) {
        eraseUnusedAttachmentsAfterSeconds = optionService.getOptionInt('eraseUnusedAttachmentsAfterSeconds');
    }

    const cutOffDate = dateUtils.utcDateTimeStr(new Date(Date.now() - (eraseUnusedAttachmentsAfterSeconds * 1000)));
    const attachmentIdsToErase = sql.getColumn('SELECT attachmentId FROM attachments WHERE utcDateScheduledForErasureSince < ?', [cutOffDate]);

    eraseAttachments(attachmentIdsToErase);
}

sqlInit.dbReady.then(() => {
    // first cleanup kickoff 5 minutes after startup
    setTimeout(cls.wrap(() => eraseDeletedEntities()), 5 * 60 * 1000);
    setTimeout(cls.wrap(() => eraseScheduledAttachments()), 6 * 60 * 1000);

    setInterval(cls.wrap(() => eraseDeletedEntities()), 4 * 3600 * 1000);
    setInterval(cls.wrap(() => eraseScheduledAttachments()), 3600 * 1000);
});

module.exports = {
    eraseDeletedNotesNow,
    eraseUnusedAttachmentsNow,
    eraseNotesWithDeleteId,
    eraseUnusedBlobs,
    eraseAttachments,
    eraseRevisions
};
