import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Network Connections</h4>
        
    <label>
        <input class="check-for-updates" type="checkbox" name="check-for-updates">
        Check for updates automatically
    </label>
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
