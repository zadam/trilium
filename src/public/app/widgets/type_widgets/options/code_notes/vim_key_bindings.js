import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Use vim keybindings in code notes (no ex mode)</h4>
    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="vim-keymap-enabled custom-control-input">
        <label class="custom-control-label">Enable Vim Keybindings</label>
    </div>
</div>`;

export default class VimKeyBindingsOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$vimKeymapEnabled = this.$widget.find(".vim-keymap-enabled");
        this.$vimKeymapEnabled.on('change', () =>
            this.updateCheckboxOption('vimKeymapEnabled', this.$vimKeymapEnabled));
    }

    async optionsLoaded(options) {
        this.setCheckboxState(this.$vimKeymapEnabled, options.vimKeymapEnabled);
    }
}
