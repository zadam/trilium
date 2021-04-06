import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";

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
        max-height: 700px;
        overflow-y: auto;
    }
    
    .note-path-list .path-current {
        font-weight: bold;
    }
    
    .note-path-list .path-archived {
        color: var(--muted-text-color) !important;
    }
    
    .note-path-list .path-search {
        font-style: italic;
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
            await this.addPath('root');
            return;
        }

        for (const notePathRecord of this.note.getSortedNotePaths(this.hoistedNoteId)) {
            await this.addPath(notePathRecord);
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

    async addPath(notePathRecord) {
        const notePath = notePathRecord.notePath.join('/');

        const title = await treeService.getNotePathTitle(notePath);

        const $noteLink = await linkService.createNoteLink(notePath, {title});

        $noteLink
            .addClass("dropdown-item");

        $noteLink
            .find('a')
            .addClass("no-tooltip-preview");

        const icons = [];

        if (this.notePath === notePath) {
            $noteLink.addClass("path-current");
        }

        if (notePathRecord.isInHoistedSubTree) {
            $noteLink.addClass("path-in-hoisted-subtree");
        }
        else {
            icons.push(`<span class="bx bx-trending-up" title="This path is outside of hoisted note and you would have to unhoist."></span>`);
        }

        if (notePathRecord.isArchived) {
            $noteLink.addClass("path-archived");

            icons.push(`<span class="bx bx-archive" title="Archived"></span>`);
        }

        if (notePathRecord.isSearch) {
            $noteLink.addClass("path-search");

            icons.push(`<span class="bx bx-search" title="Search"></span>`);
        }

        if (icons.length > 0) {
            $noteLink.append(` ${icons.join(' ')}`);
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
