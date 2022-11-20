import BasicWidget from "../../basic_widget.js";
import server from "../../../services/server.js";
import toastService from "../../../services/toast.js";

export default class OptionsTab extends BasicWidget {
    async updateOption(name, value) {
        const opts = { [name]: value };
        server.put('options', opts).then(() => {
            toastService.showPersistent({
                id: "options-change-saved",
                title: "Options status",
                message: "Options change have been saved.",
                icon: "slider",
                closeAfter: 2000
            })
        });
    }
}
