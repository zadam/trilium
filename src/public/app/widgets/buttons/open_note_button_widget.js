import ButtonWidget from "./button_widget.js";
import appContext from "../../services/app_context.js";
import froca from "../../services/froca.js";

export default class OpenNoteButtonWidget extends ButtonWidget {
    targetNote(noteId) {
        froca.getNote(noteId).then(note => {
            this.icon(note.getIcon());
            this.title(note.title);

            this.refreshIcon();
        });

        this.onClick(() => appContext.tabManager.openTabWithNoteWithHoisting(noteId, true));

        return this;
    }

    initialRenderCompleteEvent() {
        // we trigger refresh above
    }
}
