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

    <a title="Go to previous note." data-trigger-event="backInNoteHistory" class="icon-action bx bx-left-arrow-circle"></a>

    <a title="Go to next note." data-trigger-event="forwardInNoteHistory" class="icon-action bx bx-right-arrow-circle"></a>
</div>
`;

export default class HistoryNavigationWidget extends BasicWidget {
    doRender() {
        if (!utils.isElectron()) {
            return;
        }

        this.$widget = $(TPL);

        return this.$widget;
    }
}