import OnClickButtonWidget from "./onclick_button.js";
import appContext from "../../components/app_context.js";
import froca from "../../services/froca.js";

// FIXME: this widget might not be useful anymore

export default class OpenNoteButtonWidget extends OnClickButtonWidget {
    targetNote(noteId) {
        froca.getNote(noteId).then(note => {
            if (!note) {
                console.log(`Note ${noteId} has not been found. This might happen on the first run before the target note is created.`);

                if (!this.retried) {
                    this.retried = true;

                    setTimeout(() => this.targetNote(noteId), 15000); // should be higher than timeout for checkHiddenSubtree
                }

                return;
            }

            this.icon(note.getIcon());
            this.title(() => {
                const n = froca.getNoteFromCache(noteId);

                // always fresh, always decoded (when protected session is available)
                return n.title;
            });

            this.refreshIcon();
        });

        this.onClick(() => appContext.tabManager.openTabWithNoteWithHoisting(noteId, true));

        return this;
    }

    initialRenderCompleteEvent() {
        // we trigger refresh above
    }
}
