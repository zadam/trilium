import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import OptionsTab from "./options_tab.js";

const TPL = `
<div class="options-section">
    <h4>Sync</h4>
    <button id="force-full-sync-button" class="btn">Force full sync</button> 
    
    <button id="fill-entity-changes-button" class="btn">Fill entity changes records</button>
</div>

<div class="options-section">
    <h4>Database integrity check</h4>
    
    <p>This will check that the database is not corrupted on the SQLite level. It might take some time, depending on the DB size.</p>
    
    <button id="check-integrity-button" class="btn">Check database integrity</button>
</div>

<div class="options-section">
    <h4>Consistency checks</h4>
    
    <button id="find-and-fix-consistency-issues-button" class="btn">Find and fix consistency issues</button>
</div>

<div class="options-section">
    <h4>Anonymize database</h4>
    
    <h5>Full anonymization</h5>
    
    <p>This action will create a new copy of the database and anonymize it (remove all note content and leave only structure and some non-sensitive metadata)
        for sharing online for debugging purposes without fear of leaking your personal data.</p>
    
    <button id="anonymize-full-button" class="btn">Save fully anonymized database</button>

    <h5>Light anonymization</h5>
    
    <p>This action will create a new copy of the database and do a light anonymization on it - specifically only content of all notes will be removed, but titles and attributes will remain. Additionally, custom JS frontend/backend script notes and custom widgets will remain. This provides more context to debug the issues.</p>
    
    <p>You can decide yourself if you want to provide fully or lightly anonymized database. Even fully anonymized DB is very useful, however in some cases lightly anonymized database can speed up the process of bug identification and fixing.</p>
    
    <button id="anonymize-light-button" class="btn">Save lightly anonymized database</button>
</div>

<div class="options-section">
    <h4>Vacuum database</h4>
    
    <p>This will rebuild the database which will typically result in a smaller database file. No data will be actually changed.</p>
    
    <button id="vacuum-database-button" class="btn">Vacuum database</button>
</div>`;

export default class AdvancedOptions extends OptionsTab {
    get tabTitle() { return "Advanced" }

    lazyRender() {
        this.$widget = $(TPL);

        this.$forceFullSyncButton = this.$widget.find("#force-full-sync-button");
        this.$fillEntityChangesButton = this.$widget.find("#fill-entity-changes-button");
        this.$anonymizeFullButton = this.$widget.find("#anonymize-full-button");
        this.$anonymizeLightButton = this.$widget.find("#anonymize-light-button");
        this.$vacuumDatabaseButton = this.$widget.find("#vacuum-database-button");
        this.$findAndFixConsistencyIssuesButton = this.$widget.find("#find-and-fix-consistency-issues-button");
        this.$checkIntegrityButton = this.$widget.find("#check-integrity-button");

        this.$forceFullSyncButton.on('click', async () => {
            await server.post('sync/force-full-sync');

            toastService.showMessage("Full sync triggered");
        });

        this.$fillEntityChangesButton.on('click', async () => {
            toastService.showMessage("Filling entity changes rows...");

            await server.post('sync/fill-entity-changes');

            toastService.showMessage("Sync rows filled successfully");
        });

        this.$anonymizeFullButton.on('click', async () => {
            toastService.showMessage("Creating fully anonymized database...");

            const resp = await server.post('database/anonymize/full');

            if (!resp.success) {
                toastService.showError("Could not create anonymized database, check backend logs for details");
            }
            else {
                toastService.showMessage(`Created fully anonymized database in ${resp.anonymizedFilePath}`, 10000);
            }
        });

        this.$anonymizeLightButton.on('click', async () => {
            toastService.showMessage("Creating lightly anonymized database...");

            const resp = await server.post('database/anonymize/light');

            if (!resp.success) {
                toastService.showError("Could not create anonymized database, check backend logs for details");
            }
            else {
                toastService.showMessage(`Created lightly anonymized database in ${resp.anonymizedFilePath}`, 10000);
            }
        });

        this.$vacuumDatabaseButton.on('click', async () => {
            toastService.showMessage("Vacuuming database...");

            await server.post('database/vacuum-database');

            toastService.showMessage("Database has been vacuumed");
        });

        this.$findAndFixConsistencyIssuesButton.on('click', async () => {
            toastService.showMessage("Finding and fixing consistency issues...");

            await server.post('database/find-and-fix-consistency-issues');

            toastService.showMessage("Consistency issues should be fixed.");
        });

        this.$checkIntegrityButton.on('click', async () => {
            toastService.showMessage("Checking database integrity...");

            const {results} = await server.get('database/check-integrity');

            if (results.length === 1 && results[0].integrity_check === "ok") {
                toastService.showMessage("Integrity check succeeded - no problems found.");
            }
            else {
                toastService.showMessage("Integrity check failed: " + JSON.stringify(results, null, 2), 15000);
            }
        });
    }
}
