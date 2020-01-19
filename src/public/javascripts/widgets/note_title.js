import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import utils from "../services/utils.js";
import protectedSessionService from "../services/protected_session.js";
import treeUtils from "../services/tree_utils.js";
import linkService from "../services/link.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import NoteTypeWidget from "./note_type.js";
import NotePathsWidget from "./note_paths.js";
import NoteActionsWidget from "./note_actions.js";
import ProtectedNoteSwitchWidget from "./protected_note_switch.js";
import RunScriptButtonsWidget from "./run_script_buttons.js";

const TPL = `
<div>
    <style>
    .note-title {
        margin-left: 15px;
        margin-right: 10px;
        font-size: 150%;
        border: 0;
        width: 5em;
        flex-grow: 100;
    }
    </style>

    <input autocomplete="off" value="" class="note-title" tabindex="1">
</div>`;

export default class NoteTitleWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$noteTitle = this.$widget.find(".note-title");

        this.$noteTitle.on('input', () => {
            if (!this.note) {
                return;
            }

            // FIXME event not used
            this.trigger(`activeNoteChanged`);

            this.note.title = this.$noteTitle.val();

            this.tabRow.updateTab(this.$tab[0], {title: this.note.title});
            treeService.setNoteTitle(this.note.noteId, this.note.title);

            this.setTitleBar();
        });

        if (utils.isDesktop()) {
            // keyboard plugin is not loaded in mobile
            utils.bindElShortcut(this.$noteTitle, 'return', () => {
                this.getComponent().focus();

                return false; // to not propagate the enter into the editor (causes issues with codemirror)
            });
        }

        return this.$widget;
    }

    async refreshWithNote(note) {
        this.$noteTitle.val(note.title);

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            this.$noteTitle.prop("readonly", true);
        }
    }
}