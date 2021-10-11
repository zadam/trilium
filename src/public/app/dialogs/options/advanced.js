import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<h4 style="margin-top: 0;">Sync</h4>
<button id="force-full-sync-button" class="btn">Force full sync</button>

<br/>
<br/>

<button id="fill-entity-changes-button" class="btn">Fill entity changes records</button>

<br/>
<br/>

<h4>Consistency checks</h4>

<button id="find-and-fix-consistency-issues-button" class="btn">Find and fix consistency issues</button><br/><br/>

<h4>Anonymize database</h4>

<p>This action will create a new copy of the database and anonymize it (remove all note content and leave only structure and some non-sensitive metadata)
    for sharing online for debugging purposes without fear of leaking your personal data.</p>

<button id="anonymize-button" class="btn">Save anonymized database</button><br/><br/>

<h4>Vacuum database</h4>

<p>This will rebuild the database which will typically result in a smaller database file. No data will be actually changed.</p>

<button id="vacuum-database-button" class="btn">Vacuum database</button>`;

export default class AdvancedOptions {
    constructor() {
        $("#options-advanced").html(TPL);

        this.$forceFullSyncButton = $("#force-full-sync-button");
        this.$fillEntityChangesButton = $("#fill-entity-changes-button");
        this.$anonymizeButton = $("#anonymize-button");
        this.$backupDatabaseButton = $("#backup-database-button");
        this.$vacuumDatabaseButton = $("#vacuum-database-button");
        this.$findAndFixConsistencyIssuesButton = $("#find-and-fix-consistency-issues-button");

        this.$forceFullSyncButton.on('click', async () => {
            await server.post('sync/force-full-sync');

            toastService.showMessage("Full sync triggered");
        });

        this.$fillEntityChangesButton.on('click', async () => {
            await server.post('sync/fill-entity-changes');

            toastService.showMessage("Sync rows filled successfully");
        });

        this.$anonymizeButton.on('click', async () => {
            const resp = await server.post('database/anonymize');

            if (!resp.success) {
                toastService.showError("Could not create anonymized database, check backend logs for details");
            }
            else {
                toastService.showMessage(`Created anonymized database in ${resp.anonymizedFilePath}`, 10000);
            }
        });

        this.$vacuumDatabaseButton.on('click', async () => {
            await server.post('database/vacuum-database');

            toastService.showMessage("Database has been vacuumed");
        });

        this.$findAndFixConsistencyIssuesButton.on('click', async () => {
            await server.post('database/find-and-fix-consistency-issues');

            toastService.showMessage("Consistency issues should be fixed.");
        });
    }
}
