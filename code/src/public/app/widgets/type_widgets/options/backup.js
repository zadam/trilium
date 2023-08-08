import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import OptionsWidget from "./options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Automatic backup</h4>
    
    <p>Trilium can back up the database automatically:</p>
    
    <ul style="list-style: none">
        <li>
            <label>
                <input type="checkbox" class="daily-backup-enabled">
                Enable daily backup
            </label>
        </li>
        <li>    
            <label>
                <input type="checkbox" class="weekly-backup-enabled">
                Enable weekly backup
            </label>
        </li>
        <li>
        <label>
            <input type="checkbox" class="monthly-backup-enabled">
            Enable monthly backup
            </label>
        </li>
    </ul>
    
    <p>It's recommended to keep the backup turned on, but this can make application startup slow with large databases and/or slow storage devices.</p>
</div>

<div class="options-section">
    <h4>Backup now</h4>
    
    <button class="backup-database-button btn">Backup database now</button>
</div>
`;

export default class BackupOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$backupDatabaseButton = this.$widget.find(".backup-database-button");

        this.$backupDatabaseButton.on('click', async () => {
            const {backupFile} = await server.post('database/backup-database');

            toastService.showMessage(`Database has been backed up to ${backupFile}`, 10000);
        });

        this.$dailyBackupEnabled = this.$widget.find(".daily-backup-enabled");
        this.$weeklyBackupEnabled = this.$widget.find(".weekly-backup-enabled");
        this.$monthlyBackupEnabled = this.$widget.find(".monthly-backup-enabled");

        this.$dailyBackupEnabled.on('change', () =>
            this.updateCheckboxOption('dailyBackupEnabled', this.$dailyBackupEnabled));

        this.$weeklyBackupEnabled.on('change', () =>
            this.updateCheckboxOption('weeklyBackupEnabled', this.$weeklyBackupEnabled));

        this.$monthlyBackupEnabled.on('change', () =>
            this.updateCheckboxOption('monthlyBackupEnabled', this.$monthlyBackupEnabled));
    }

    optionsLoaded(options) {
        this.setCheckboxState(this.$dailyBackupEnabled, options.dailyBackupEnabled);
        this.setCheckboxState(this.$weeklyBackupEnabled, options.weeklyBackupEnabled);
        this.setCheckboxState(this.$monthlyBackupEnabled, options.monthlyBackupEnabled);
    }
}
