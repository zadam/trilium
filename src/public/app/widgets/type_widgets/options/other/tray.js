import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Tray</h4>

    <label>
        <input type="checkbox" class="tray-enabled">
        Enable tray (Trilium needs to be restarted for this change to take effect)
    </label>
</div>`;

export default class TrayOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$trayEnabled = this.$widget.find(".tray-enabled");
        this.$trayEnabled.on('change', () =>
            this.updateOption('disableTray', !this.$trayEnabled.is(":checked") ? "true" : "false"));
    }

    async optionsLoaded(options) {
        this.$trayEnabled.prop("checked", options.disableTray !== 'true');
    }
}
