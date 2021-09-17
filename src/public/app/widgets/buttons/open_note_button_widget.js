import ButtonWidget from "./button_widget.js";
import appContext from "../../services/app_context.js";

// TODO: here we could read icon and title of the target note and use it for tooltip and displayed icon

export default class OpenNoteButtonWidget extends ButtonWidget {
    targetNote(noteId) {
        this.onClick(() => appContext.tabManager.openTabWithNoteWithHoisting(noteId, true));

        return this;
    }
}
