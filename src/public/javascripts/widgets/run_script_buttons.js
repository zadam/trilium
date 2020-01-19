import TabAwareWidget from "./tab_aware_widget.js";
import protectedSessionService from "../services/protected_session.js";
import protectedSessionHolder from "../services/protected_session_holder.js";

const TPL = `
<div>
    <button class="btn btn-sm icon-button bx bx-play-circle render-button"
            style="display: none; margin-right: 10px;"
            title="Render"></button>
    
    <button class="btn btn-sm icon-button bx bx-play-circle execute-script-button"
            style="display: none; margin-right: 10px;"
            title="Execute (Ctrl+Enter)"></button>
</div>`;

export default class RunScriptButtonsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$renderButton = this.$widget.find('.render-button');
        this.$executeScriptButton = this.$widget.find('.execute-script-button');

        return this.$widget;
    }

    refreshWithNote(note) {
        this.$renderButton.toggle(note.type === 'render');
        this.$executeScriptButton.toggle(note.mime.startsWith('application/javascript'));
    }
}