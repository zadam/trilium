import OptionsWidget from "../options_widget.js";
import server from "../../../../services/server.js";
import toastService from "../../../../services/toast.js";

const TPL = `
<div class="options-section">
    <h4>Sync</h4>
    <button class="force-full-sync-button btn">Force full sync</button> 
    
    <button class="fill-entity-changes-button btn">Fill entity changes records</button>
</div>`;

export default class AdvancedSyncOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$forceFullSyncButton = this.$widget.find(".force-full-sync-button");
        this.$fillEntityChangesButton = this.$widget.find(".fill-entity-changes-button");
        this.$forceFullSyncButton.on('click', async () => {
            await server.post('sync/force-full-sync');

            toastService.showMessage("Full sync triggered");
        });

        this.$fillEntityChangesButton.on('click', async () => {
            toastService.showMessage("Filling entity changes rows...");

            await server.post('sync/fill-entity-changes');

            toastService.showMessage("Sync rows filled successfully");
        });
    }

    async optionsLoaded(options) {

    }
}
