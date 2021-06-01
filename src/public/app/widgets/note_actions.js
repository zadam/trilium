import TabAwareWidget from "./tab_aware_widget.js";
import protectedSessionService from "../services/protected_session.js";
import utils from "../services/utils.js";

const TPL = `
<div class="dropdown note-actions">
    <style>
    .note-actions .dropdown-menu {
        width: 20em;
    }
    
    .note-actions .dropdown-item[disabled], .note-actions .dropdown-item[disabled]:hover {
        color: var(--muted-text-color) !important;
        background-color: transparent !important;
        pointer-events: none; /* makes it unclickable */
    }
    
    /* The switch - the box around the slider */
    .switch {
        position: relative;
        display: inline-block;
        width: 50px;
        height: 24px;
        float: right;
    }
    
    /* The slider */
    .slider {
        border-radius: 24px;
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: var(--more-accented-background-color);
        transition: .4s;
    }
    
    .slider:before {
        border-radius: 50%;
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 4px;
        bottom: 4px;
        background-color: var(--main-background-color);
        -webkit-transition: .4s;
        transition: .4s;
    }
    
    .slider.checked {
        background-color: var(--main-text-color);
    }
    
    .slider.checked:before {
        transform: translateX(26px);
    }
    
    .dropdown-center {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .dropdown-icon {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .dropdown-icon > div {
        margin-right: .2em;
    }
    
    .switch-handler .switch {
        margin-bottom: 0; /* Centers switch */
    }
    
    .inset {
        padding-left: 3em;
    }
    </style>

    <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
        Actions
        <span class="caret"></span>
    </button>
    <div class="dropdown-menu dropdown-menu-right">
        <a data-trigger-command="renderActiveNote" class="dropdown-item render-note-button"><kbd data-command="renderActiveNote"></kbd> Re-render note</a>
        <div class="dropdown-item dropdown-center protect-button switch-handler">
            <div class="dropdown-icon">
                <div class="bx bx-lock"></div>
                Protect the note
            </div>
        
            <span title="Note is not protected, click to make it protected">
                <label class="switch">
                <span class="slider"></span>
            </span>
        </div>
        <div class="dropdown-item dropdown-center unprotect-button switch-handler">
            <div class="dropdown-icon">
                <div class="bx bx-lock-open"></div>
                Unprotect the note
            </div>
        
            <span title="Note is protected, click to make it unprotected">
                <label class="switch">
                <span class="slider checked"></span>
            </span>
        </div>
        <a data-trigger-command="findInText" class="dropdown-item">
            <div class="bx bx-search"></div>
            Search in note
            <kbd data-command="findInText">
        </a>
        <a data-trigger-command="showNoteRevisions" class="dropdown-item show-note-revisions-button">
            <div class="dropdown-icon">
                <div class="bx bx-list-ul"></div>
                Revisions
            </div>
        </a>
        <a data-trigger-command="showLinkMap" class="dropdown-item show-link-map-button inset">
            <kbd data-command="showLinkMap"></kbd>
            Link map
        </a>
        <a data-trigger-command="showNoteSource" class="dropdown-item show-source-button inset">
            <kbd data-command="showNoteSource"></kbd>
            Note source
        </a>
        <a data-trigger-command="openNoteExternally" class="dropdown-item open-note-externally-button inset">
            <div class="dropdown-icon">
                <div class="bx bx-link-external"></div>
                Open note externally
            </div>
            <kbd data-command="openNoteExternally"></kbd>
        </a>
        <a class="dropdown-item import-files-button">
            <div class="dropdown-icon">
                <div class="bx bxs-file-import"></div>
                Import files
            </div>
        </a>
        <a class="dropdown-item export-note-button">
            <div class="dropdown-icon">
                <div class="bx bx-export"></div>
                Export note
            </div>
        </a>
        <a data-trigger-command="printActiveNote" class="dropdown-item print-note-button inset">
            <div class="dropdown-icon">
                <div class="bx bx-printer"></div>
                Print note
            </div>
            <kbd data-command="printActiveNote"></kbd>
        </a>
        <a data-trigger-command="showNoteInfo" class="dropdown-item show-note-info-button inset">
            <div class="dropdown-icon">
                <div class="bx bx-info-circle"></div>
                Note info
            </div>
            <kbd data-command="showNoteInfo"></kbd>
        </a>
    </div>
</div>`;

export default class NoteActionsWidget extends TabAwareWidget {
    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$showSourceButton = this.$widget.find('.show-source-button');
        this.$renderNoteButton = this.$widget.find('.render-note-button');

        this.$exportNoteButton = this.$widget.find('.export-note-button');
        this.$exportNoteButton.on("click", () => {
            if (this.$exportNoteButton.hasClass("disabled")) {
                return;
            }

            import('../dialogs/export.js').then(d => d.showDialog(this.tabContext.notePath, 'single'));
        });

        this.$importNoteButton = this.$widget.find('.import-files-button');
        this.$importNoteButton.on("click", () => import('../dialogs/import.js').then(d => d.showDialog(this.noteId)));

        this.$protectButton = this.$widget.find(".protect-button");
        this.$protectButton.on('click', () => protectedSessionService.protectNote(this.noteId, true, false));

        this.$unprotectButton = this.$widget.find(".unprotect-button");
        this.$unprotectButton.on('click', () => protectedSessionService.protectNote(this.noteId, false, false));

        this.$widget.on('click', '.dropdown-item',
            () => this.$widget.find('.dropdown-toggle').dropdown('toggle'));

        this.$openNoteExternallyButton = this.$widget.find(".open-note-externally-button");
    }

    refreshWithNote(note) {
        this.toggleDisabled(this.$showSourceButton, ['text', 'relation-map', 'search', 'code'].includes(note.type));

        this.$renderNoteButton.toggle(note.type === 'render');

        this.$protectButton.toggle(!note.isProtected);
        this.$unprotectButton.toggle(!!note.isProtected);

        this.$openNoteExternallyButton.toggle(utils.isElectron());
    }

    toggleDisabled($el, enable) {
        if (enable) {
            $el.removeAttr('disabled');
        } else {
            $el.attr('disabled', 'disabled');
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
