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
    
    <div class="note-path-intro"></div>
    
    <ul class="note-path-list"></ul>
    
    <button class="btn btn-sm" data-trigger-command="cloneNoteIdsTo">Clone note to new location...</button>
</div>`;

export default class NotePathsWidget extends NoteContextAwareWidget {
    get name() {
        return "notePaths";
    }

    get toggleCommand() {
        return "toggleRibbonTabNotePaths";
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
        this.contentSized();

        this.$notePathIntro = this.$widget.find(".note-path-intro");
        this.$notePathList = this.$widget.find(".note-path-list");
        this.$widget.on('show.bs.dropdown', () => this.renderDropdown());
    }

    async refreshWithNote(note) {
        this.$notePathList.empty();

        if (this.noteId === 'root') {
            this.$notePathList.empty().append(
                await this.getRenderedPath('root')
            );

            return;
        }

        const sortedNotePaths = this.note.getSortedNotePathRecords(this.hoistedNoteId)
            .filter(notePath => !notePath.isHidden);

        if (sortedNotePaths.length > 0) {
            this.$notePathIntro.text("This note is placed into the following paths:");
        }
        else {
            this.$notePathIntro.text("This note is not yet placed into the note tree.");
        }

        const renderedPaths = [];

        for (const notePathRecord of sortedNotePaths) {
            const notePath = notePathRecord.notePath.join('/');

            renderedPaths.push(await this.getRenderedPath(notePath, notePathRecord));
        }

        this.$notePathList.empty().append(...renderedPaths);
    }

    async getRenderedPath(notePath, notePathRecord = null) {
        const title = await treeService.getNotePathTitle(notePath);

        const $noteLink = await linkService.createLink(notePath, {title});

        $noteLink
            .find('a')
            .addClass("no-tooltip-preview");

        const icons = [];

        if (this.notePath === notePath) {
            $noteLink.addClass("path-current");
        }

        if (!notePathRecord || notePathRecord.isInHoistedSubTree) {
            $noteLink.addClass("path-in-hoisted-subtree");
        }
        else {
            icons.push(`<span class="bx bx-trending-up" title="This path is outside of hoisted note and you would have to unhoist."></span>`);
        }

        if (notePathRecord?.isArchived) {
            $noteLink.addClass("path-archived");

            icons.push(`<span class="bx bx-archive" title="Archived"></span>`);
        }

        if (notePathRecord?.isSearch) {
            $noteLink.addClass("path-search");

            icons.push(`<span class="bx bx-search" title="Search"></span>`);
        }

        if (icons.length > 0) {
            $noteLink.append(` ${icons.join(' ')}`);
        }

        return $("<li>").append($noteLink);
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranchRows().find(branch => branch.noteId === this.noteId)
            || loadResults.isNoteReloaded(this.noteId)) {

            this.refresh();
        }
    }
}
