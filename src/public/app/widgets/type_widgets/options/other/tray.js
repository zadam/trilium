import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Tray</h4>

    <div class="custom-control custom-checkbox">
        <input type="checkbox" class="tray-enabled custom-control-input">
        <label class="custom-control-label">Enable tray (Trilium needs to be restarted for this change to take effect)</label>
    </div>
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
