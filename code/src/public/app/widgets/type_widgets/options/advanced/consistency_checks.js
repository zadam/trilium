import OptionsWidget from "../options_widget.js";
import toastService from "../../../../services/toast.js";
import server from "../../../../services/server.js";

const TPL = `
<div class="options-section">
    <h4>Consistency Checks</h4>
    
    <button class="find-and-fix-consistency-issues-button btn">Find and fix consistency issues</button>
</div>`;

export default class ConsistencyChecksOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$findAndFixConsistencyIssuesButton = this.$widget.find(".find-and-fix-consistency-issues-button");
        this.$findAndFixConsistencyIssuesButton.on('click', async () => {
            toastService.showMessage("Finding and fixing consistency issues...");

            await server.post('database/find-and-fix-consistency-issues');

            toastService.showMessage("Consistency issues should be fixed.");
        });
    }
}
