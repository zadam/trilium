import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Automatic Read-Only Size</h4>

    <p>Automatic read-only note size is the size after which notes will be displayed in a read-only mode (for performance reasons).</p>

    <div class="form-group">
        <label>Automatic read-only size (text notes)</label>
        <input class="auto-readonly-size-text form-control options-number-input" type="number" min="0">
    </div>
</div>`;

export default class TextAutoReadOnlySizeOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$autoReadonlySizeText = this.$widget.find(".auto-readonly-size-text");
        this.$autoReadonlySizeText.on('change', () =>
            this.updateOption('autoReadonlySizeText', this.$autoReadonlySizeText.val()));
    }

    async optionsLoaded(options) {
        this.$autoReadonlySizeText.val(options.autoReadonlySizeText);
    }
}
