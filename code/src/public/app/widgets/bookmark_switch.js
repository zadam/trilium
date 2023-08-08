import SwitchWidget from "./switch.js";
import server from "../services/server.js";
import toastService from "../services/toast.js";

export default class BookmarkSwitchWidget extends SwitchWidget {
    isEnabled() {
        return super.isEnabled()
            // it's not possible to bookmark root because that would clone it under bookmarks and thus create a cycle
            && !['root', '_hidden'].includes(this.noteId);
    }

    doRender() {
        super.doRender();

        this.$switchOnName.text("Bookmark");
        this.$switchOnButton.attr("title", "Bookmark this note to the left side panel");

        this.$switchOffName.text("Bookmark");
        this.$switchOffButton.attr("title", "Remove bookmark");
    }

    async toggle(state) {
        const resp = await server.put(`notes/${this.noteId}/toggle-in-parent/_lbBookmarks/${!!state}`);

        if (!resp.success) {
            toastService.showError(resp.message);
        }
    }

    async refreshWithNote(note) {
        const isBookmarked = !!note.getParentBranches().find(b => b.parentNoteId === '_lbBookmarks');

        this.$switchOn.toggle(!isBookmarked);
        this.$switchOff.toggle(isBookmarked);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranchRows().find(b => b.noteId === this.noteId)) {
            this.refresh();
        }
    }
}
