import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<h4 style="margin-top: 0;">Sync</h4>
<button id="force-full-sync-button" class="btn">Force full sync</button>

<br/>
<br/>

<button id="fill-sync-rows-button" class="btn">Fill sync rows</button>

<br/>
<br/>

<h4>Consistency checks</h4>

<button id="find-and-fix-consistency-issues-button" class="btn">Find and fix consistency issues</button><br/><br/>

<h4>Debugging</h4>

<button id="anonymize-button" class="btn">Save anonymized database</button><br/><br/>

<p>This action will create a new copy of the database and anonymise it (remove all note content and leave only structure and metadata)
    for sharing online for debugging purposes without fear of leaking your personal data.</p>

<h4>Vacuum database</h4>

<p>This will rebuild database which will typically result in smaller database file. No data will be actually changed.</p>

<button id="vacuum-database-button" class="btn">Vacuum database</button>`;

export default class AdvancedOptions {
    constructor() {
        $("#options-advanced").html(TPL);

        this.$forceFullSyncButton = $("#force-full-sync-button");
        this.$fillSyncRowsButton = $("#fill-sync-rows-button");
        this.$anonymizeButton = $("#anonymize-button");
        this.$vacuumDatabaseButton = $("#vacuum-database-button");
        this.$findAndFixConsistencyIssuesButton = $("#find-and-fix-consistency-issues-button");

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

        this.$vacuumDatabaseButton.on('click', async () => {
            await server.post('cleanup/vacuum-database');

            toastService.showMessage("Database has been vacuumed");
        });

        this.$findAndFixConsistencyIssuesButton.on('click', async () => {
            await server.post('cleanup/find-and-fix-consistency-issues');

            toastService.showMessage("Consistency issues should be fixed.");
        });
    }
}