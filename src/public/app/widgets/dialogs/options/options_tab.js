import BasicWidget from "../../basic_widget.js";
import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";

export default class OptionsTab extends BasicWidget {
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
}
