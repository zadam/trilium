import NoteContextAwareWidget from "./note_context_aware_widget.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";
import branchService from "../services/branches.js";
import shortcutService from "../services/shortcuts.js";

const TPL = `
<div class="note-title-widget">
    <style>
    .note-title-widget {
        flex-grow: 1000;
        height: 100%;
    }
    
    .note-title-widget input.note-title {
        font-size: 180%;
        border: 0;
        min-width: 5em;
        width: 100%;
    }
    
    .note-title-widget input.note-title.protected {
        text-shadow: 4px 4px 4px var(--muted-text-color);
    }
    </style>

    <input autocomplete="off" value="" placeholder="type note's title here..." class="note-title" tabindex="100">
</div>`;

export default class NoteTitleWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(async () => {
            const title = this.$noteTitle.val();

            protectedSessionHolder.touchProtectedSessionIfNecessary(this.note);

            await server.put(`notes/${this.noteId}/title`, {title}, this.componentId);
        });

        this.deleteNoteOnEscape = false;

        appContext.addBeforeUnloadListener(this);
    }

    doRender() {
        this.$widget = $(TPL);
        this.$noteTitle = this.$widget.find(".note-title");

        this.$noteTitle.on('input', () => this.spacedUpdate.scheduleUpdate());

        this.$noteTitle.on('blur', () => {
            this.spacedUpdate.updateNowIfNecessary();

            this.deleteNoteOnEscape = false;
        });

        shortcutService.bindElShortcut(this.$noteTitle, 'esc', () => {
            if (this.deleteNoteOnEscape && this.noteContext.isActive()) {
                branchService.deleteNotes(Object.values(this.noteContext.note.parentToBranch));
            }
        });

        shortcutService.bindElShortcut(this.$noteTitle, 'return', () => {
            this.triggerCommand('focusOnDetail', {ntxId: this.noteContext.ntxId});
        });
    }

    async refreshWithNote(note) {
        const isReadOnly = (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable())
            || ['_lbRoot', '_lbAvailableLaunchers', '_lbVisibleLaunchers'].includes(note.noteId)
            || this.noteContext.viewScope.viewMode !== 'default';

        this.$noteTitle.val(
            isReadOnly
                ? await this.noteContext.getNavigationTitle()
                : note.title
        );
        this.$noteTitle.prop("readonly", isReadOnly);

        this.setProtectedStatus(note);
    }

    /** @param {FNote} note */
    setProtectedStatus(note) {
        this.$noteTitle.toggleClass("protected", !!note.isProtected);
    }

    async beforeNoteSwitchEvent({noteContext}) {
        if (this.isNoteContext(noteContext.ntxId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    async beforeNoteContextRemoveEvent({ntxIds}) {
        if (this.isNoteContext(ntxIds)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    focusOnTitleEvent() {
        if (this.noteContext && this.noteContext.isActive()) {
            this.$noteTitle.trigger('focus');
        }
    }

    focusAndSelectTitleEvent({isNewNote} = {isNewNote: false}) {
        if (this.noteContext && this.noteContext.isActive()) {
            this.$noteTitle
                .trigger('focus')
                .trigger('select');

            this.deleteNoteOnEscape = isNewNote;
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            // not updating the title specifically since the synced title might be older than what the user is currently typing
            this.setProtectedStatus(this.note);
        }

        if (loadResults.isNoteReloaded(this.noteId, this.componentId)) {
            this.refresh();
        }
    }

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }
}
