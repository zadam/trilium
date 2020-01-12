import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import utils from "../services/utils.js";
import protectedSessionService from "../services/protected_session.js";
import treeUtils from "../services/tree_utils.js";
import linkService from "../services/link.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import NoteTypeWidget from "./note_type.js";

const TPL = `
<style>
.note-title-row {
    flex-grow: 0;
    flex-shrink: 0;
    padding-top: 2px;
}

.note-title {
    margin-left: 15px;
    margin-right: 10px;
    font-size: 150%;
    border: 0;
    width: 5em;
    flex-grow: 100;
}
</style>

<div class="note-title-row">
    <div style="display: flex; align-items: center;">
        <div class="dropdown hide-in-zen-mode">
            <button class="btn btn-sm dropdown-toggle note-path-list-button" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                <span class="note-path-count">1 path</span>

                <span class="caret"></span>
            </button>
            <ul class="note-path-list dropdown-menu" aria-labelledby="note-path-list-button">
            </ul>
        </div>

        <input autocomplete="off" value="" class="note-title" tabindex="1">

        <span class="saved-indicator hide-in-zen-mode bx bx-check" title="All changes have been saved"></span>

        <div class="hide-in-zen-mode" style="display: flex; align-items: center;">
            <button class="btn btn-sm icon-button bx bx-play-circle render-button"
                    style="display: none; margin-right: 10px;"
                    title="Render"></button>

            <button class="btn btn-sm icon-button bx bx-play-circle execute-script-button"
                    style="display: none; margin-right: 10px;"
                    title="Execute (Ctrl+Enter)"></button>

            <div class="btn-group btn-group-xs">
                <button type="button"
                        class="btn btn-sm icon-button bx bx-check-shield protect-button"
                        title="Protected note can be viewed and edited only after entering password">
                </button>

                <button type="button"
                        class="btn btn-sm icon-button bx bx-shield unprotect-button"
                        title="Not protected note can be viewed without entering password">
                </button>
            </div>

            &nbsp; &nbsp;

            <div style="display: flex;">
                <!-- note type here -->

                <div class="dropdown note-actions">
                    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
                        Note actions
                        <span class="caret"></span>
                    </button>
                    <div class="dropdown-menu dropdown-menu-right">
                        <a class="dropdown-item show-note-revisions-button" data-bind="css: { disabled: type() == 'file' || type() == 'image' }">Revisions</a>
                        <a class="dropdown-item show-attributes-button"><kbd data-kb-action="ShowAttributes"></kbd> Attributes</a>
                        <a class="dropdown-item show-link-map-button"><kbd data-kb-action="ShowLinkMap"></kbd> Link map</a>
                        <a class="dropdown-item show-source-button" data-bind="css: { disabled: type() != 'text' && type() != 'code' && type() != 'relation-map' && type() != 'search' }">
                            <kbd data-kb-action="ShowNoteSource"></kbd>
                            Note source
                        </a>
                        <a class="dropdown-item import-files-button">Import files</a>
                        <a class="dropdown-item export-note-button" data-bind="css: { disabled: type() != 'text' }">Export note</a>
                        <a class="dropdown-item print-note-button"><kbd data-kb-action="PrintActiveNote"></kbd> Print note</a>
                        <a class="dropdown-item show-note-info-button"><kbd data-kb-action="ShowNoteInfo"></kbd> Note info</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>`;

export default class NoteTitleWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.tree = null;
    }

    doRender() {
        const $widget = $(TPL);

        this.$noteTitle = $widget.find(".note-title");
        this.$noteTitleRow = $widget.find(".note-title-row");
        this.$notePathList = $widget.find(".note-path-list");
        this.$notePathCount = $widget.find(".note-path-count");

        this.$protectButton = $widget.find(".protect-button");
        this.$protectButton.on('click', protectedSessionService.protectNoteAndSendToServer);

        this.$unprotectButton = $widget.find(".unprotect-button");
        this.$unprotectButton.on('click', protectedSessionService.unprotectNoteAndSendToServer);

        this.$savedIndicator = $widget.find(".saved-indicator");

        this.noteType = new NoteTypeWidget(this);

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

        return $widget;
    }

    async activeTabChanged() {
        const note = this.tabContext.note;

        this.$noteTitle.val(note.title);

        this.$protectButton.toggleClass("active", note.isProtected);
        this.$protectButton.prop("disabled", note.isProtected);
        this.$unprotectButton.toggleClass("active", !note.isProtected);
        this.$unprotectButton.prop("disabled", !note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());

        await this.showPaths();
    }

    async showPaths() {
        const note = this.tabContext.note;

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

            const pathSegments = this.notePath.split("/");
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

    noteSavedListener() {
        this.$savedIndicator.fadeIn();
    }
}