import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Note revisions snapshot interval</h4>

    <p>Note revision snapshot time interval is time in seconds after which a new note revision will be created for the note. See <a href="https://github.com/zadam/trilium/wiki/Note-revisions" class="external">wiki</a> for more info.</p>

    <div class="form-group">
        <label>Note revision snapshot time interval (in seconds)</label>
        <input class="note-revision-snapshot-time-interval-in-seconds form-control" type="number" min="10">
    </div>
</div>`;

export default class NoteRevisionsSnapshotIntervalOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$noteRevisionsTimeInterval = this.$widget.find(".note-revision-snapshot-time-interval-in-seconds");
        this.$noteRevisionsTimeInterval.on('change', () =>
            this.updateOption('noteRevisionSnapshotTimeInterval', this.$noteRevisionsTimeInterval.val()));
    }

    async optionsLoaded(options) {
        this.$noteRevisionsTimeInterval.val(options.noteRevisionSnapshotTimeInterval);
    }
}
