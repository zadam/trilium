import server from "../../services/server.js";
import toastService from "../../services/toast.js";

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

            toastService.showMessage("Full sync triggered");
        });

        this.$fillSyncRowsButton.click(async () => {
            await server.post('sync/fill-sync-rows');

            toastService.showMessage("Sync rows filled successfully");
        });

        this.$anonymizeButton.click(async () => {
            await server.post('anonymization/anonymize');

            toastService.showMessage("Created anonymized database");
        });

        this.$cleanupSoftDeletedButton.click(async () => {
            if (confirm("Do you really want to clean up soft-deleted items?")) {
                await server.post('cleanup/cleanup-soft-deleted-items');

                toastService.showMessage("Soft deleted items have been cleaned up");
            }
        });

        this.$cleanupUnusedImagesButton.click(async () => {
            if (confirm("Do you really want to clean up unused images?")) {
                await server.post('cleanup/cleanup-unused-images');

                toastService.showMessage("Unused images have been cleaned up");
            }
        });

        this.$vacuumDatabaseButton.click(async () => {
            await server.post('cleanup/vacuum-database');

            toastService.showMessage("Database has been vacuumed");
        });
    }
}