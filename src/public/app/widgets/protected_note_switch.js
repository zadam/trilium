import protectedSessionService from "../services/protected_session.js";
import SwitchWidget from "./switch.js";

export default class ProtectedNoteSwitchWidget extends SwitchWidget {
    doRender() {
        super.doRender();

        this.$switchOnName.text("Protect the note");
        this.$switchOnButton.attr("title", "Note is not protected, click to make it protected");

        this.$switchOffName.text("Unprotect the note");
        this.$switchOffButton.attr("title", "Note is protected, click to make it unprotected");
    }

    switchOn() {
        protectedSessionService.protectNote(this.noteId, true, false);
    }

    switchOff() {
        protectedSessionService.protectNote(this.noteId, false, false)
    }

    refreshWithNote(note) {
        this.$switchOn.toggle(!note.isProtected);
        this.$switchOff.toggle(!!note.isProtected);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
