import OptionsWidget from "../options_widget.js";
import toastService from "../../../../services/toast.js";
import server from "../../../../services/server.js";

const TPL = `
<div class="options-section">
    <h4>Database Integrity Check</h4>
    
    <p>This will check that the database is not corrupted on the SQLite level. It might take some time, depending on the DB size.</p>
    
    <button class="check-integrity-button btn">Check database integrity</button>
</div>`;

export default class DatabaseIntegrityCheckOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$checkIntegrityButton = this.$widget.find(".check-integrity-button");
        this.$checkIntegrityButton.on('click', async () => {
            toastService.showMessage("Checking database integrity...");

            const {results} = await server.get('database/check-integrity');

            if (results.length === 1 && results[0].integrity_check === "ok") {
                toastService.showMessage("Integrity check succeeded - no problems found.");
            }
            else {
                toastService.showMessage(`Integrity check failed: ${JSON.stringify(results, null, 2)}`, 15000);
            }
        });
    }
}
