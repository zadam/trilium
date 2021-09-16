import ButtonWidget from "./button_widget.js";
import appContext from "../../services/app_context.js";

export default class OpenNoteButtonWidget extends ButtonWidget {
    targetNote(noteId) {
        this.onClick(() => appContext.tabManager.openTabWithNoteWithHoisting(noteId, true));

        return this;
    }
}
