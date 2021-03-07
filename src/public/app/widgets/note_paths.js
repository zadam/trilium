import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import hoistedNoteService from "../services/hoisted_note.js";

const TPL = `
<div class="dropdown note-paths-widget">
    <style>
    .note-path-list-button {
        font-size: 120% !important;
    }
    
    .note-path-list-button::after {
        display: none !important; // disabling the standard caret
    }
    
    .note-path-list {
        max-height: 600px;
        overflow-y: auto;
    }
    </style>
    
    <button class="btn dropdown-toggle note-path-list-button bx bx-collection" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" title="Note paths"></button>
    <ul class="note-path-list dropdown-menu dropdown-menu-right" aria-labelledby="note-path-list-button">
    </ul>
</div>`;

export default class NotePathsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$notePathList = this.$widget.find(".note-path-list");
        this.$widget.on('show.bs.dropdown', () => this.renderDropdown());
    }

    async renderDropdown() {
        this.$notePathList.empty();
        this.$notePathList.append(
            $("<div>")
                .addClass("dropdown-header")
                .text('This note is placed into the following paths:')
        );

        if (this.noteId === 'root') {
            await this.addPath('root', true);
            return;
        }

        for (const notePath of this.note.getSortedNotePaths(this.hoistedNoteId)) {
            const notePathStr = notePath.join('/');
console.log(notePathStr, this.notePath, notePathStr === this.notePath);
            await this.addPath(notePathStr, notePathStr === this.notePath);
        }

        const cloneLink = $("<div>")
            .addClass("dropdown-header")
            .append(
                $('<button class="btn btn-sm">')
                    .text('Clone note to new location...')
                    .on('click', () => import("../dialogs/clone_to.js").then(d => d.showDialog([this.noteId])))
            );

        this.$notePathList.append(cloneLink);
    }

    async addPath(notePath, isCurrent) {
        const title = await treeService.getNotePathTitle(notePath);

        const $noteLink = await linkService.createNoteLink(notePath, {title});

        $noteLink
            .addClass("dropdown-item");

        $noteLink
            .find('a')
            .addClass("no-tooltip-preview");

        if (isCurrent) {
            $noteLink.addClass("current");
        }

        this.$notePathList.append($noteLink);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranches().find(branch => branch.noteId === this.noteId)
            || loadResults.isNoteReloaded(this.noteId)) {

            this.refresh();
        }
    }

    async refresh() {
        await super.refresh();

        this.$widget.find('.dropdown-toggle').dropdown('hide');
    }
}
