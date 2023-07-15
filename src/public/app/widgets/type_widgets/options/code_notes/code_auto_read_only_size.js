import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Automatic Read-Only Size</h4>

    <p>Automatic read-only note size is the size after which notes will be displayed in a read-only mode (for performance reasons).</p>

    <div class="form-group">
        <label>Automatic read-only size (code notes)</label>
        <input class="auto-readonly-size-code form-control options-number-input" type="number" min="0">
    </div>
</div>`;

export default class CodeAutoReadOnlySizeOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$autoReadonlySizeCode = this.$widget.find(".auto-readonly-size-code");
        this.$autoReadonlySizeCode.on('change', () =>
            this.updateOption('autoReadonlySizeCode', this.$autoReadonlySizeCode.val()));
    }

    async optionsLoaded(options) {
        this.$autoReadonlySizeCode.val(options.autoReadonlySizeCode);
    }
}
