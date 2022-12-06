import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";
import NoteContextAwareWidget from "../../note_context_aware_widget.js";

export default class OptionsTab extends NoteContextAwareWidget {
    async updateOption(name, value) {
        const opts = { [name]: value };

        await this.updateMultipleOptions(opts);
    }

    async updateMultipleOptions(opts) {
        await server.put('options', opts);

        this.showUpdateNotification();
    }

    showUpdateNotification() {
        toastService.showPersistent({
            id: "options-change-saved",
            title: "Options status",
            message: "Options change have been saved.",
            icon: "slider",
            closeAfter: 2000
        });
    }

    async updateCheckboxOption(name, $checkbox) {
        const isChecked = $checkbox.prop("checked");

        return await this.updateOption(name, isChecked ? 'true' : 'false');
    }

    setCheckboxState($checkbox, optionValue) {
        $checkbox.prop('checked', optionValue === 'true');
    }

    async refreshWithNote(note) {
        const options = await server.get('options');

        this.optionsLoaded(options);
    }
}
