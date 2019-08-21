import server from "../../services/server.js";
import infoService from "../../services/info.js";

export default class AdvancedOptions {
    constructor() {
        this.$forceFullSyncButton = $("#force-full-sync-button");
        this.$fillSyncRowsButton = $("#fill-sync-rows-button");
        this.$anonymizeButton = $("#anonymize-button");
        this.$cleanupSoftDeletedButton = $("#cleanup-soft-deleted-items-button");
        this.$cleanupUnusedImagesButton = $("#cleanup-unused-images-button");
        this.$vacuumDatabaseButton = $("#vacuum-database-button");

        this.$forceFullSyncButton.click(async () => {
            await server.post('sync/force-full-sync');

            infoService.showMessage("Full sync triggered");
        });

        this.$fillSyncRowsButton.click(async () => {
            await server.post('sync/fill-sync-rows');

            infoService.showMessage("Sync rows filled successfully");
        });

        this.$anonymizeButton.click(async () => {
            await server.post('anonymization/anonymize');

            infoService.showMessage("Created anonymized database");
        });

        this.$cleanupSoftDeletedButton.click(async () => {
            if (confirm("Do you really want to clean up soft-deleted items?")) {
                await server.post('cleanup/cleanup-soft-deleted-items');

                infoService.showMessage("Soft deleted items have been cleaned up");
            }
        });

        this.$cleanupUnusedImagesButton.click(async () => {
            if (confirm("Do you really want to clean up unused images?")) {
                await server.post('cleanup/cleanup-unused-images');

                infoService.showMessage("Unused images have been cleaned up");
            }
        });

        this.$vacuumDatabaseButton.click(async () => {
            await server.post('cleanup/vacuum-database');

            infoService.showMessage("Database has been vacuumed");
        });
    }
}