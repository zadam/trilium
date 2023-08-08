import OptionsWidget from "../options_widget.js";
import server from "../../../../services/server.js";
import toastService from "../../../../services/toast.js";

const TPL = `
<div class="options-section">
    <h4>Note Erasure Timeout</h4>

    <p>Deleted notes (and attributes, revisions...) are at first only marked as deleted and it is possible to recover them 
    from Recent Notes dialog. After a period of time, deleted notes are "erased" which means 
    their content is not recoverable anymore. This setting allows you to configure the length 
    of the period between deleting and erasing the note.</p>

    <div class="form-group">
        <label>Erase notes after X seconds</label>
        <input class="erase-entities-after-time-in-seconds form-control options-number-input" type="number" min="0">
    </div>
    
    <p>You can also trigger erasing manually (without considering the timeout defined above):</p>
    
    <button class="erase-deleted-notes-now-button btn">Erase deleted notes now</button>
</div>`;

export default class NoteErasureTimeoutOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$eraseEntitiesAfterTimeInSeconds = this.$widget.find(".erase-entities-after-time-in-seconds");
        this.$eraseEntitiesAfterTimeInSeconds.on('change', () => this.updateOption('eraseEntitiesAfterTimeInSeconds', this.$eraseEntitiesAfterTimeInSeconds.val()));

        this.$eraseDeletedNotesButton = this.$widget.find(".erase-deleted-notes-now-button");
        this.$eraseDeletedNotesButton.on('click', () => {
            server.post('notes/erase-deleted-notes-now').then(() => {
                toastService.showMessage("Deleted notes have been erased.");
            });
        });
    }

    async optionsLoaded(options) {
        this.$eraseEntitiesAfterTimeInSeconds.val(options.eraseEntitiesAfterTimeInSeconds);
    }
}
