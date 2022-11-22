import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import OptionsTab from "./options_tab.js";

const TPL = `
<div class="options-section">
    <h4>Tray</h4>

    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="custom-control-input" id="tray-enabled">
        <label class="custom-control-label" for="tray-enabled">Enable tray (Trilium needs to be restarted for this change to take effect)</label>
    </div>
</div>

<div class="options-section">
    <h4>Note erasure timeout</h4>

    <p>Deleted notes (and attributes, revisions...) are at first only marked as deleted and it is possible to recover them 
    from Recent Notes dialog. After a period of time, deleted notes are "erased" which means 
    their content is not recoverable anymore. This setting allows you to configure the length 
    of the period between deleting and erasing the note.</p>

    <div class="form-group">
        <label for="erase-entities-after-time-in-seconds">Erase notes after X seconds</label>
        <input class="form-control" id="erase-entities-after-time-in-seconds" type="number" min="0">
    </div>
    
    <p>You can also trigger erasing manually:</p>
    
    <button id="erase-deleted-notes-now-button" class="btn">Erase deleted notes now</button>
</div>

<div class="options-section">
    <h4>Note revisions snapshot interval</h4>

    <p>Note revision snapshot time interval is time in seconds after which a new note revision will be created for the note. See <a href="https://github.com/zadam/trilium/wiki/Note-revisions" class="external">wiki</a> for more info.</p>

    <div class="form-group">
        <label for="note-revision-snapshot-time-interval-in-seconds">Note revision snapshot time interval (in seconds)</label>
        <input class="form-control" id="note-revision-snapshot-time-interval-in-seconds" type="number" min="10">
    </div>
</div>

<div class="options-section">
    <h4>Network connections</h4>
        
    <div class="form-group">
        <input id="check-for-updates" type="checkbox" name="check-for-updates">
        <label for="check-for-updates">Check for updates automatically</label>
    </div>
</div>`;

export default class OtherOptions extends OptionsTab {
    get tabTitle() { return "Other" }

    lazyRender() {
        this.$widget = $(TPL);

        this.$trayEnabled = this.$widget.find("#tray-enabled");
        this.$trayEnabled.on('change', () =>
            this.updateOption('disableTray', !this.$trayEnabled.is(":checked") ? "true" : "false"));

        this.$eraseEntitiesAfterTimeInSeconds = this.$widget.find("#erase-entities-after-time-in-seconds");
        this.$eraseEntitiesAfterTimeInSeconds.on('change', () => this.updateOption('eraseEntitiesAfterTimeInSeconds', this.$eraseEntitiesAfterTimeInSeconds.val()));

        this.$eraseDeletedNotesButton = this.$widget.find("#erase-deleted-notes-now-button");
        this.$eraseDeletedNotesButton.on('click', () => {
            server.post('notes/erase-deleted-notes-now').then(() => {
                toastService.showMessage("Deleted notes have been erased.");
            });
        });

        this.$noteRevisionsTimeInterval = this.$widget.find("#note-revision-snapshot-time-interval-in-seconds");

        this.$noteRevisionsTimeInterval.on('change', () =>
            this.updateOption('noteRevisionSnapshotTimeInterval', this.$noteRevisionsTimeInterval.val()));

        this.$checkForUpdates = this.$widget.find("#check-for-updates");
        this.$checkForUpdates.on("change", () =>
            this.updateCheckboxOption('checkForUpdates', this.$checkForUpdates));
    }

    optionsLoaded(options) {
        this.$trayEnabled.prop("checked", options.disableTray !== 'true');

        this.$eraseEntitiesAfterTimeInSeconds.val(options.eraseEntitiesAfterTimeInSeconds);
        this.$noteRevisionsTimeInterval.val(options.noteRevisionSnapshotTimeInterval);

        this.setCheckboxState(this.$checkForUpdates, options.checkForUpdates);
    }
}
