import BasicWidget from "./basic_widget.js";
import utils from "../services/utils.js";
import keyboardActionService from "../services/keyboard_actions.js";

const TPL = `
<div class="history-navigation">
    <style>
    .history-navigation {
        margin: 0 15px 0 5px;
    }
    </style>

    <a title="Go to previous note." class="history-back-button icon-action bx bx-left-arrow-circle"></a>

    <a title="Go to next note." class="history-forward-button icon-action bx bx-right-arrow-circle"></a>
</div>
`;

export default class HistoryNavigationWidget extends BasicWidget {
    render() {
        if (!utils.isElectron()) {
            return;
        }

        this.$widget = $(TPL);

        this.$widget.find(".history-back-button").on('click', window.history.back);
        this.$widget.find(".history-forward-button").on('click', window.history.forward);

        // FIXME: does not belong here
        keyboardActionService.setGlobalActionHandler("BackInNoteHistory", window.history.back);
        keyboardActionService.setGlobalActionHandler("ForwardInNoteHistory", window.history.forward);

        return this.$widget;
    }
}