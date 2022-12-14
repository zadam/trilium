import OptionsWidget from "../options_widget.js";
import toastService from "../../../../services/toast.js";
import server from "../../../../services/server.js";

const TPL = `
<div class="options-section">
    <h4>Database anonymization</h4>
    
    <h5>Full anonymization</h5>
    
    <p>This action will create a new copy of the database and anonymize it (remove all note content and leave only structure and some non-sensitive metadata)
        for sharing online for debugging purposes without fear of leaking your personal data.</p>
    
    <button class="anonymize-full-button btn">Save fully anonymized database</button>

    <h5>Light anonymization</h5>
    
    <p>This action will create a new copy of the database and do a light anonymization on it - specifically only content of all notes will be removed, but titles and attributes will remain. Additionally, custom JS frontend/backend script notes and custom widgets will remain. This provides more context to debug the issues.</p>
    
    <p>You can decide yourself if you want to provide fully or lightly anonymized database. Even fully anonymized DB is very useful, however in some cases lightly anonymized database can speed up the process of bug identification and fixing.</p>
    
    <button class="anonymize-light-button btn">Save lightly anonymized database</button>
</div>`;

export default class DatabaseAnonymizationOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$anonymizeFullButton = this.$widget.find(".anonymize-full-button");
        this.$anonymizeLightButton = this.$widget.find(".anonymize-light-button");
        this.$anonymizeFullButton.on('click', async () => {
            toastService.showMessage("Creating fully anonymized database...");

            const resp = await server.post('database/anonymize/full');

            if (!resp.success) {
                toastService.showError("Could not create anonymized database, check backend logs for details");
            }
            else {
                toastService.showMessage(`Created fully anonymized database in ${resp.anonymizedFilePath}`, 10000);
            }
        });

        this.$anonymizeLightButton.on('click', async () => {
            toastService.showMessage("Creating lightly anonymized database...");

            const resp = await server.post('database/anonymize/light');

            if (!resp.success) {
                toastService.showError("Could not create anonymized database, check backend logs for details");
            }
            else {
                toastService.showMessage(`Created lightly anonymized database in ${resp.anonymizedFilePath}`, 10000);
            }
        });
    }
}
