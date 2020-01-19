import BasicWidget from "./basic_widget.js";
import protectedSessionService from "../services/protected_session.js";
import protectedSessionHolder from "../services/protected_session_holder.js";

const TPL = `
<div class="btn-group btn-group-xs">
    <button type="button"
            class="btn btn-sm icon-button bx bx-check-shield protect-button"
            title="Protected note can be viewed and edited only after entering password">
    </button>

    <button type="button"
            class="btn btn-sm icon-button bx bx-shield unprotect-button"
            title="Not protected note can be viewed without entering password">
    </button>
</div>`;

export default class ProtectedNoteSwitchWidget extends BasicWidget {
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