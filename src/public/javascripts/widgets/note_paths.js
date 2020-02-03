import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";

const TPL = `
<div class="dropdown hide-in-zen-mode">
    <style>
    .note-path-list a.current {
        font-weight: bold;
    }
    </style>

    <button class="btn btn-sm dropdown-toggle note-path-list-button" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
        <span class="note-path-count">1 path</span>

        <span class="caret"></span>
    </button>
    <ul class="note-path-list dropdown-menu" aria-labelledby="note-path-list-button">
    </ul>
</div>`;

export default class NotePathsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$notePathList = this.$widget.find(".note-path-list");
        this.$notePathCount = this.$widget.find(".note-path-count");

        this.$widget.on('show.bs.dropdown', () => this.renderDropdown());

        return this.$widget;
    }

    async refreshWithNote(note, notePath) {
        const pathCount = note.noteId === 'root'
            ? 1 // root doesn't have any parent, but it's still technically 1 path
            : note.getBranchIds().length;

        this.$notePathCount.html(pathCount + " path" + (pathCount > 1 ? "s" : ""));
    }

    async renderDropdown() {
        this.$notePathList.empty();

        if (this.noteId === 'root') {
            await this.addPath('root', true);
            return;
        }

        const pathSegments = this.notePath.split("/");
        const activeNoteParentNoteId = pathSegments[pathSegments.length - 2]; // we know this is not root so there must be a parent

        for (const parentNote of await this.note.getParentNotes()) {
            const parentNotePath = await treeService.getSomeNotePath(parentNote);
            // this is to avoid having root notes leading '/'
            const notePath = parentNotePath ? (parentNotePath + '/' + this.noteId) : this.noteId;
            const isCurrent = activeNoteParentNoteId === parentNote.noteId;

            await this.addPath(notePath, isCurrent);
        }

        const cloneLink = $("<div>")
            .addClass("dropdown-item")
            .append(
                $('<button class="btn btn-sm">')
                    .text('Clone note to new location...')
                    .on('click', () => import("../dialogs/clone_to.js").then(d => d.showDialog([this.noteId])))
            );

        this.$notePathList.append(cloneLink);
    }

    async addPath(notePath, isCurrent) {
        const title = await treeService.getNotePathTitle(notePath);

        const noteLink = await linkService.createNoteLink(notePath, {title});

        noteLink
            .addClass("dropdown-item");

        noteLink
            .find('a')
            .addClass("no-tooltip-preview");

        if (isCurrent) {
            noteLink.addClass("current");
        }

        this.$notePathList.append(noteLink);
    }
}