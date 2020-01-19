import TabAwareWidget from "./tab_aware_widget.js";
import protectedSessionService from "../services/protected_session.js";
import protectedSessionHolder from "../services/protected_session_holder.js";

const TPL = `
<button class="btn btn-sm icon-button bx bx-play-circle render-button"
        style="display: none; margin-right: 10px;"
        title="Render"></button>

<button class="btn btn-sm icon-button bx bx-play-circle execute-script-button"
        style="display: none; margin-right: 10px;"
        title="Execute (Ctrl+Enter)"></button>`;

export default class RunScriptButtonsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$protectButton = this.$widget.find(".protect-button");
        this.$protectButton.on('click', protectedSessionService.protectNoteAndSendToServer);

        this.$unprotectButton = this.$widget.find(".unprotect-button");
        this.$unprotectButton.on('click', protectedSessionService.unprotectNoteAndSendToServer);

        return this.$widget;
    }

    refreshWithNote(note) {
        this.$protectButton.toggleClass("active", note.isProtected);
        this.$protectButton.prop("disabled", note.isProtected);
        this.$unprotectButton.toggleClass("active", !note.isProtected);
        this.$unprotectButton.prop("disabled", !note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());
    }
}