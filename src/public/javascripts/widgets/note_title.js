import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import utils from "../services/utils.js";
import protectedSessionService from "../services/protected_session.js";
import treeUtils from "../services/tree_utils.js";
import linkService from "../services/link.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import NoteTypeWidget from "./note_type.js";
import NotePathsWidget from "./note_paths.js";

const TPL = `
<div class="note-title-row">
    <style>
    .note-title-row {
        flex-grow: 0;
        flex-shrink: 0;
        padding-top: 2px;
        display: flex; 
        align-items: center;
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

        <div class="note-type-actions" style="display: flex;">
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
</div>`;

export default class NoteTitleWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$noteTitle = this.$widget.find(".note-title");

        this.$protectButton = this.$widget.find(".protect-button");
        this.$protectButton.on('click', protectedSessionService.protectNoteAndSendToServer);

        this.$unprotectButton = this.$widget.find(".unprotect-button");
        this.$unprotectButton.on('click', protectedSessionService.unprotectNoteAndSendToServer);

        this.$savedIndicator = this.$widget.find(".saved-indicator");

        this.noteType = new NoteTypeWidget(this.appContext);
        this.$widget.find('.note-type-actions').prepend(this.noteType.render());

        this.notePaths = new NotePathsWidget(this.appContext);
        this.$widget.prepend(this.notePaths.render());

        this.children.push(this.noteType, this.notePaths);

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

        return this.$widget;
    }

    async refresh() {
        const note = this.tabContext.note;

        this.$noteTitle.val(note.title);

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            this.$noteTitle.prop("readonly", true);
        }

        this.$protectButton.toggleClass("active", note.isProtected);
        this.$protectButton.prop("disabled", note.isProtected);
        this.$unprotectButton.toggleClass("active", !note.isProtected);
        this.$unprotectButton.prop("disabled", !note.isProtected || !protectedSessionHolder.isProtectedSessionAvailable());
    }

    noteSavedListener() {
        this.$savedIndicator.fadeIn();
    }
}