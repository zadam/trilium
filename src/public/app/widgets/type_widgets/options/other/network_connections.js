import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Network connections</h4>
        
    <div class="form-group">
        <input class="check-for-updates" type="checkbox" name="check-for-updates">
        <label>Check for updates automatically</label>
    </div>
</div>`;

export default class NetworkConnectionsOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$checkForUpdates = this.$widget.find(".check-for-updates");
        this.$checkForUpdates.on("change", () =>
            this.updateCheckboxOption('checkForUpdates', this.$checkForUpdates));
    }

    async optionsLoaded(options) {
        this.setCheckboxState(this.$checkForUpdates, options.checkForUpdates);
    }
}
