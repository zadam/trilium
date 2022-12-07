import OptionsWidget from "../options_widget.js";
import toastService from "../../../../services/toast.js";
import server from "../../../../services/server.js";

const TPL = `
<div class="options-section">
    <h4>Vacuum database</h4>
    
    <p>This will rebuild the database which will typically result in a smaller database file. No data will be actually changed.</p>
    
    <button class="vacuum-database-button btn">Vacuum database</button>
</div>`;

export default class VacuumDatabaseOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$vacuumDatabaseButton = this.$widget.find(".vacuum-database-button");
        this.$vacuumDatabaseButton.on('click', async () => {
            toastService.showMessage("Vacuuming database...");

            await server.post('database/vacuum-database');

            toastService.showMessage("Database has been vacuumed");
        });
    }
}
