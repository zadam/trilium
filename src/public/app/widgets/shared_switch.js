import SwitchWidget from "./switch.js";
import branchService from "../services/branches.js";
import server from "../services/server.js";
import utils from "../services/utils.js";

export default class SharedSwitchWidget extends SwitchWidget {
    isEnabled() {
        return super.isEnabled() && this.noteId !== 'root' && this.noteId !== 'share';
    }

    doRender() {
        super.doRender();

        this.$switchOnName.text("Shared");
        this.$switchOnButton.attr("title", "Share the note");

        this.$switchOffName.text("Shared");
        this.$switchOffButton.attr("title", "Unshare the note");

        this.$helpButton.attr("data-help-page", "Sharing").show();
        this.$helpButton.on('click', e => utils.openHelp(e));
    }

    switchOn() {
        branchService.cloneNoteToNote(this.noteId, 'share');
    }

    async switchOff() {
        const shareBranch = this.note.getParentBranches().find(b => b.parentNoteId === 'share');

        if (!shareBranch) {
            return;
        }

        if (this.note.getParentBranches().length === 1) {
            const confirmDialog = await import('../dialogs/confirm.js');

            const text = "This note exists only as a shared note, unsharing would delete it. Do you want to continue and thus delete this note?";

            if (!await confirmDialog.confirm(text)) {
                return;
            }
        }

        await server.remove(`branches/${shareBranch.branchId}?taskId=no-progress-reporting`);
    }

    async refreshWithNote(note) {
        const isShared = note.hasAncestor('share');
        const canBeUnshared = isShared && note.getParentBranches().find(b => b.parentNoteId === 'share');
        const switchDisabled = isShared && !canBeUnshared;

        this.$switchOn.toggle(!isShared);
        this.$switchOff.toggle(!!isShared);

        if (switchDisabled) {
            this.$widget.attr("title", "Note cannot be unshared here because it is shared through inheritance from an ancestor.");
            this.$switchOff.addClass("switch-disabled");
        }
        else {
            this.$widget.removeAttr("title");
            this.$switchOff.removeClass("switch-disabled");
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranches().find(b => b.noteId === this.noteId)) {
            this.refresh();
        }
    }
}
