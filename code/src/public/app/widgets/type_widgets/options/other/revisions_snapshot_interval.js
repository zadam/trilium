import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Note Revisions Snapshot Interval</h4>

    <p>Note revision snapshot time interval is time in seconds after which a new note revision will be created for the note. See <a href="https://github.com/zadam/trilium/wiki/Note-revisions" class="external">wiki</a> for more info.</p>

    <div class="form-group">
        <label>Note revision snapshot time interval (in seconds)</label>
        <input class="revision-snapshot-time-interval-in-seconds form-control options-number-input" type="number" min="10">
    </div>
</div>`;

export default class RevisionsSnapshotIntervalOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$revisionsTimeInterval = this.$widget.find(".revision-snapshot-time-interval-in-seconds");
        this.$revisionsTimeInterval.on('change', () =>
            this.updateOption('revisionSnapshotTimeInterval', this.$revisionsTimeInterval.val()));
    }

    async optionsLoaded(options) {
        this.$revisionsTimeInterval.val(options.revisionSnapshotTimeInterval);
    }
}
