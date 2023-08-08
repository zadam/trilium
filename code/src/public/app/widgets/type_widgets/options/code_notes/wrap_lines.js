import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Wrap lines in code notes</h4>
    <label>
        <input type="checkbox" class="line-wrap-enabled">
        Enable Line Wrap (change might need a frontend reload to take effect)
    </label>
</div>`;

export default class WrapLinesOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$codeLineWrapEnabled = this.$widget.find(".line-wrap-enabled");
        this.$codeLineWrapEnabled.on('change', () =>
            this.updateCheckboxOption('codeLineWrapEnabled', this.$codeLineWrapEnabled));
    }

    async optionsLoaded(options) {
        this.setCheckboxState(this.$codeLineWrapEnabled, options.codeLineWrapEnabled);
    }
}
