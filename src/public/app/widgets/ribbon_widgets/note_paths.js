import NoteContextAwareWidget from "../note_context_aware_widget.js";
import treeService from "../../services/tree.js";
import linkService from "../../services/link.js";

const TPL = `
<div class="note-paths-widget">
    <style>
    .note-paths-widget {
        padding: 12px;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .note-path-list {
        margin-top: 10px;
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
    
    <div>This note is placed into the following paths:</div>
    
    <ul class="note-path-list"></ul>
    
    <button class="btn btn-sm" data-trigger-command="cloneNoteIdsTo">Clone note to new location...</button>
</div>`;

export default class NotePathsWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note;
    }

    getTitle() {
        return {
            show: true,
            title: 'Note Paths',
            icon: 'bx bx-collection'
        };
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$notePathList = this.$widget.find(".note-path-list");
        this.$widget.on('show.bs.dropdown', () => this.renderDropdown());
    }

    async refreshWithNote(note) {
        this.$notePathList.empty();

        if (this.noteId === 'root') {
            await this.addPath('root');
            return;
        }

        for (const notePathRecord of this.note.getSortedNotePaths(this.hoistedNoteId)) {
            await this.addPath(notePathRecord);
        }
    }

    async addPath(notePathRecord) {
        const notePath = notePathRecord.notePath.join('/');

        const title = await treeService.getNotePathTitle(notePath);

        const $noteLink = await linkService.createNoteLink(notePath, {title});

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

        this.$notePathList.append($("<li>").append($noteLink));
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranches().find(branch => branch.noteId === this.noteId)
            || loadResults.isNoteReloaded(this.noteId)) {

            this.refresh();
        }
    }
}
