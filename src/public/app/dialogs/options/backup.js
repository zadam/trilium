import server from "../../services/server.js";
import toastService from "../../services/toast.js";

const TPL = `
<h4>Automatic backup</h4>

<p>Trilium can back up the database automatically:</p>

<div class="custom-control custom-checkbox">
    <input type="checkbox" class="custom-control-input" id="daily-backup-enabled">
    <label class="custom-control-label" for="daily-backup-enabled">Enable daily backup</label>
</div>

<div class="custom-control custom-checkbox">
    <input type="checkbox" class="custom-control-input" id="weekly-backup-enabled">
    <label class="custom-control-label" for="weekly-backup-enabled">Enable weekly backup</label>
</div>

<div class="custom-control custom-checkbox">
    <input type="checkbox" class="custom-control-input" id="monthly-backup-enabled">
    <label class="custom-control-label" for="monthly-backup-enabled">Enable monthly backup</label>
</div>

<br/>

<p>It's recommended to keep the backup turned on, but this can make application startup slow with large databases and/or slow storage devices.</p>

<br/>

<h4>Backup now</h4>

<button id="backup-database-button" class="btn">Backup database now</button><br/><br/>
`;

export default class BackupOptions {
    constructor() {
        $("#options-backup").html(TPL);

        this.$backupDatabaseButton = $("#backup-database-button");

        this.$backupDatabaseButton.on('click', async () => {
            const {backupFile} = await server.post('database/backup-database');

            toastService.showMessage("Database has been backed up to " + backupFile, 10000);
        });

        this.$dailyBackupEnabled = $("#daily-backup-enabled");
        this.$weeklyBackupEnabled = $("#weekly-backup-enabled");
        this.$monthlyBackupEnabled = $("#monthly-backup-enabled");

        this.$dailyBackupEnabled.on('change', () => {
            const opts = { 'dailyBackupEnabled': this.$dailyBackupEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$weeklyBackupEnabled.on('change', () => {
            const opts = { 'weeklyBackupEnabled': this.$weeklyBackupEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });

        this.$monthlyBackupEnabled.on('change', () => {
            const opts = { 'monthlyBackupEnabled': this.$monthlyBackupEnabled.is(":checked") ? "true" : "false" };
            server.put('options', opts).then(() => toastService.showMessage("Options changed have been saved."));

            return false;
        });
    }

    optionsLoaded(options) {
        this.$dailyBackupEnabled.prop("checked", options['dailyBackupEnabled'] === 'true');
        this.$weeklyBackupEnabled.prop("checked", options['weeklyBackupEnabled'] === 'true');
        this.$monthlyBackupEnabled.prop("checked", options['monthlyBackupEnabled'] === 'true');
    }
}
