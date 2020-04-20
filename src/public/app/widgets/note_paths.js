import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import hoistedNoteService from "../services/hoisted_note.js";

const TPL = `
<div class="note-paths-widget">
    <style>
    .note-paths-widget {
        display: flex; 
        flex-direction: row;
        border-bottom: 1px solid var(--main-border-color);
        padding: 5px 10px 5px 10px;
    }
    
    .note-path-list a.current {
        font-weight: bold;
    }
    
    .note-path-list-button {
        padding: 0;
        width: 24px;
        height: 24px;
        margin-left: 5px;
        position: relative;
        top: -2px;
    }
    
    .note-path-list-button::after {
        display: none !important; // disabling the standard caret
    }
    
    .current-path {
        flex-grow: 1;
        white-space: nowrap; 
        overflow: hidden; 
        text-overflow: ellipsis;
    }
    </style>

    <div class="current-path"></div>

    <div class="dropdown hide-in-zen-mode">
        <button class="btn btn-sm dropdown-toggle note-path-list-button bx bx-caret-down" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"></button>
        <ul class="note-path-list dropdown-menu dropdown-menu-right" aria-labelledby="note-path-list-button">
        </ul>
    </div>
</div>`;

export default class NotePathsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$currentPath = this.$widget.find('.current-path');
        this.$dropdown = this.$widget.find(".dropdown");

        this.$notePathList = this.$dropdown.find(".note-path-list");

        this.$dropdown.on('show.bs.dropdown', () => this.renderDropdown());

        return this.$widget;
    }

    async refreshWithNote(note, notePath) {
        const noteIdsPath = treeService.parseNotePath(notePath);

        this.$currentPath.empty();

        let parentNoteId = 'root';
        let curPath = '';

        let passedHoistedNote = false;

        for (let i = 0; i < noteIdsPath.length; i++) {
            const noteId = noteIdsPath[i];

            curPath += (curPath ? '/' : '') + noteId;

            if (noteId === hoistedNoteService.getHoistedNoteId()) {
                passedHoistedNote = true;
            }

            if (passedHoistedNote && (noteId !== hoistedNoteService.getHoistedNoteId() || noteIdsPath.length - i < 3)) {
                this.$currentPath.append(
                    $("<a>")
                        .attr('href', '#' + curPath)
                        .attr('data-note-path', curPath)
                        .addClass('no-tooltip-preview')
                        .text(await treeService.getNoteTitle(noteId, parentNoteId))
                );

                if (i !== noteIdsPath.length - 1) {
                    this.$currentPath.append(' / ');
                }
            }

            parentNoteId = noteId;
        }
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

        const pathSegments = treeService.parseNotePath(this.notePath);
        const activeNoteParentNoteId = pathSegments[pathSegments.length - 2]; // we know this is not root so there must be a parent

        for (const parentNote of this.note.getParentNotes()) {
            const parentNotePath = await treeService.getSomeNotePath(parentNote);
            // this is to avoid having root notes leading '/'
            const notePath = parentNotePath ? (parentNotePath + '/' + this.noteId) : this.noteId;
            const isCurrent = activeNoteParentNoteId === parentNote.noteId;

            await this.addPath(notePath, isCurrent);
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

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getBranches().find(branch => branch.noteId === this.noteId)) {
            this.refresh();
        }
    }
}