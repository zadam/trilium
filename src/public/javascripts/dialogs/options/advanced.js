import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<h4 style="margin-top: 0;">Sync</h4>
<button id="force-full-sync-button" class="btn btn-secondary">Force full sync</button>

<br/>
<br/>

<button id="fill-sync-rows-button" class="btn btn-secondary">Fill sync rows</button>

<br/>
<br/>

<h4>Debugging</h4>

<button id="anonymize-button" class="btn btn-secondary">Save anonymized database</button><br/><br/>

<p>This action will create a new copy of the database and anonymise it (remove all note content and leave only structure and metadata)
    for sharing online for debugging purposes without fear of leaking your personal data.</p>

<h4>Vacuum database</h4>

<p>This will rebuild database which will typically result in smaller database file. No data will be actually changed.</p>

<button id="vacuum-database-button" class="btn btn-secondary">Vacuum database</button>`;

export default class AdvancedOptions {
    constructor() {
        $("#options-advanced").html(TPL);

        this.$forceFullSyncButton = $("#force-full-sync-button");
        this.$fillSyncRowsButton = $("#fill-sync-rows-button");
        this.$anonymizeButton = $("#anonymize-button");
        this.$cleanupSoftDeletedButton = $("#cleanup-soft-deleted-items-button");
        this.$cleanupUnusedImagesButton = $("#cleanup-unused-images-button");
        this.$vacuumDatabaseButton = $("#vacuum-database-button");

        this.$forceFullSyncButton.on('click', async () => {
            await server.post('sync/force-full-sync');

            toastService.showMessage("Full sync triggered");
        });

        this.$fillSyncRowsButton.on('click', async () => {
            await server.post('sync/fill-sync-rows');

            toastService.showMessage("Sync rows filled successfully");
        });

        this.$anonymizeButton.on('click', async () => {
            await server.post('anonymization/anonymize');

            toastService.showMessage("Created anonymized database");
        });

        this.$cleanupSoftDeletedButton.on('click', async () => {
            if (confirm("Do you really want to clean up soft-deleted items?")) {
                await server.post('cleanup/cleanup-soft-deleted-items');

                toastService.showMessage("Soft deleted items have been cleaned up");
            }
        });

        this.$cleanupUnusedImagesButton.on('click', async () => {
            if (confirm("Do you really want to clean up unused images?")) {
                await server.post('cleanup/cleanup-unused-images');

                toastService.showMessage("Unused images have been cleaned up");
            }
        });

        this.$vacuumDatabaseButton.on('click', async () => {
            await server.post('cleanup/vacuum-database');

            toastService.showMessage("Database has been vacuumed");
        });
    }
}