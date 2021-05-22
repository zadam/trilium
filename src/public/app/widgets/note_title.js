import NoteContextAwareWidget from "./note_context_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../services/app_context.js";

const TPL = `
<div class="note-title-container">
    <style>
    .note-title-container {
        flex-grow: 100;
    }
    
    .note-title-container input.note-title {
        font-size: 180%;
        border: 0;
        min-width: 5em;
        width: 100%;
    }
    
    .note-title-container input.note-title.protected {
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

            await server.put(`notes/${this.noteId}/change-title`, {title}, this.componentId);
        });

        appContext.addBeforeUnloadListener(this);
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$noteTitle = this.$widget.find(".note-title");

        this.$noteTitle.on('input', () => this.spacedUpdate.scheduleUpdate());

        utils.bindElShortcut(this.$noteTitle, 'return', () => {
            this.triggerCommand('focusOnAttributes', {ntxId: this.noteContext.ntxId});
        });
    }

    async refreshWithNote(note) {
        this.$noteTitle.val(note.title);

        this.$noteTitle.prop("readonly", note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable());

        this.setProtectedStatus(note);
    }

    setProtectedStatus(note) {
        this.$noteTitle.toggleClass("protected", !!note.isProtected);
    }

    async beforeNoteSwitchEvent({noteContext}) {
        if (this.isNoteContext(noteContext.ntxId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    async beforeTabRemoveEvent({ntxIds}) {
        if (this.isNoteContext(ntxIds)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    focusOnTitleEvent() {
        if (this.noteContext && this.noteContext.isActive()) {
            this.$noteTitle.trigger('focus');
        }
    }

    focusAndSelectTitleEvent() {
        if (this.noteContext && this.noteContext.isActive()) {
            this.$noteTitle
                .trigger('focus')
                .trigger('select');
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
