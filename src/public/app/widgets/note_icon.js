import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";

const TPL = `
<div class="note-icon-container">
    <style>
    .note-icon-container {
        padding-top: 3px;
        padding-left: 7px;
        margin-right: 0;
    }
    
    .note-icon-container span {
        font-size: 180%;
    }
    </style>

    <span class="bx bx-archive"></span>
</div>`;

export default class NoteIconWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$icon = this.$widget.find('span');
        this.contentSized();
    }

    async refreshWithNote(note) {
        this.$icon.removeClass().addClass(note.getIcon())
    }
}
