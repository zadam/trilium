import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import treeUtils from "../services/tree_utils.js";
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

        return this.$widget;
    }

    async refresh() {
        const {note, notePath} = this.tabContext;

        if (note.noteId === 'root') {
            // root doesn't have any parent, but it's still technically 1 path

            this.$notePathCount.html("1 path");

            this.$notePathList.empty();

            await this.addPath('root', true);
        }
        else {
            const parents = await note.getParentNotes();

            this.$notePathCount.html(parents.length + " path" + (parents.length > 1 ? "s" : ""));
            this.$notePathList.empty();

            const pathSegments = notePath.split("/");
            const activeNoteParentNoteId = pathSegments[pathSegments.length - 2]; // we know this is not root so there must be a parent

            for (const parentNote of parents) {
                const parentNotePath = await treeService.getSomeNotePath(parentNote);
                // this is to avoid having root notes leading '/'
                const notePath = parentNotePath ? (parentNotePath + '/' + note.noteId) : note.noteId;
                const isCurrent = activeNoteParentNoteId === parentNote.noteId;

                await this.addPath(notePath, isCurrent);
            }

            const cloneLink = $("<div>")
                .addClass("dropdown-item")
                .append(
                    $('<button class="btn btn-sm">')
                        .text('Clone note to new location...')
                        .on('click', () => import("../dialogs/clone_to.js").then(d => d.showDialog([note.noteId])))
                );

            this.$notePathList.append(cloneLink);
        }
    }

    async addPath(notePath, isCurrent) {
        const title = await treeUtils.getNotePathTitle(notePath);

        const noteLink = await linkService.createNoteLink(notePath, {title});

        noteLink
            .addClass("no-tooltip-preview")
            .addClass("dropdown-item");

        if (isCurrent) {
            noteLink.addClass("current");
        }

        this.$notePathList.append(noteLink);
    }
}