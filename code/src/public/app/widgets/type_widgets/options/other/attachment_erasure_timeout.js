import OptionsWidget from "../options_widget.js";
import server from "../../../../services/server.js";
import toastService from "../../../../services/toast.js";

const TPL = `
<div class="options-section">
    <h4>Attachment Erasure Timeout</h4>

    <p>Attachments get automatically deleted (and erased) if they are not referenced by their note anymore after a defined time out.</p>

    <div class="form-group">
        <label>Erase attachments after X seconds of not being used in its note</label>
        <input class="erase-unused-attachments-after-time-in-seconds form-control options-number-input" type="number" min="0">
    </div>
    
    <p>You can also trigger erasing manually (without considering the timeout defined above):</p>
    
    <button class="erase-unused-attachments-now-button btn">Erase unused attachment notes now</button>
</div>`;

export default class AttachmentErasureTimeoutOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$eraseUnusedAttachmentsAfterTimeInSeconds = this.$widget.find(".erase-unused-attachments-after-time-in-seconds");
        this.$eraseUnusedAttachmentsAfterTimeInSeconds.on('change', () => this.updateOption('eraseUnusedAttachmentsAfterSeconds', this.$eraseUnusedAttachmentsAfterTimeInSeconds.val()));

        this.$eraseUnusedAttachmentsNowButton = this.$widget.find(".erase-unused-attachments-now-button");
        this.$eraseUnusedAttachmentsNowButton.on('click', () => {
            server.post('notes/erase-unused-attachments-now').then(() => {
                toastService.showMessage("Unused attachments have been erased.");
            });
        });
    }

    async optionsLoaded(options) {
        this.$eraseUnusedAttachmentsAfterTimeInSeconds.val(options.eraseUnusedAttachmentsAfterSeconds);
    }
}
