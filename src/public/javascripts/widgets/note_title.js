import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import treeCache from "../services/tree_cache.js";
import server from "../services/server.js";

const TPL = `
<div class="note-title-container">
    <style>
    .note-title-container {
        flex-grow: 100;
    }
    
    .note-title-container input.note-title {
        margin-left: 15px;
        margin-right: 10px;
        font-size: 150%;
        border: 0;
        min-width: 5em;
        width: 100%;
    }
    </style>

    <input autocomplete="off" value="" class="note-title" tabindex="1">
</div>`;

class SpacedUpdate {
    constructor(updater, updateInterval = 1000) {
        this.updater = updater;
        this.lastUpdated = Date.now();
        this.changed = false;
        this.updateInterval = updateInterval;
    }

    scheduleUpdate() {
        this.changed = true;
        setTimeout(() => this.triggerUpdate())
    }

    async updateNowIfNecessary() {
        if (this.changed) {
            this.changed = false;
            await this.updater();
        }
    }

    triggerUpdate() {
        if (!this.changed) {
            return;
        }

        if (Date.now() - this.lastUpdated > this.updateInterval) {
            this.updater();
            this.lastUpdated = Date.now();
            this.changed = false;
        }
        else {
            // update not triggered but changes are still pending so we need to schedule another check
            this.scheduleUpdate();
        }
    }
}

export default class NoteTitleWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.spacedUpdate = new SpacedUpdate(async () => {
            const noteId = this.tabContext.note.noteId;
            const title = this.$noteTitle.val();

            const resp = await server.put(`notes/${noteId}/change-title`, {title});

            // FIXME: minor - does not propagate to other tab contexts with this note though
            this.tabContext.note.dateModified = resp.dateModified;
            this.tabContext.note.utcDateModified = resp.utcDateModified;

            this.trigger('noteChangesSaved', {noteId})
        });
    }

    doRender() {
        this.$widget = $(TPL);
        this.$noteTitle = this.$widget.find(".note-title");

        this.$noteTitle.on('input', () => this.titleChanged());

        utils.bindElShortcut(this.$noteTitle, 'return', () => {
            this.trigger('focusOnDetail', {tabId: this.tabContext.tabId});
        });

        return this.$widget;
    }

    async titleChanged() {
        const {note} = this.tabContext;

        if (!note) {
            return;
        }

        note.title = this.$noteTitle.val();

        this.spacedUpdate.scheduleUpdate();

        const noteFromCache = await treeCache.getNote(note.noteId);
        noteFromCache.title = note.title;

        this.trigger(`noteTitleChanged`, {
            tabId: this.tabContext.tabId, // used to identify that the event comes from this tab so we should not update this tab's input
            title: note.title,
            noteId: note.noteId
        });
    }

    noteTitleChangedListener({tabId, title, noteId}) {
        if (tabId === this.tabContext.tabId
            || !this.tabContext.note
            || this.tabContext.note.noteId !== noteId) {

            return;
        }

        this.$noteTitle.val(title);
    }

    async refreshWithNote(note) {
        this.$noteTitle.val(note.title);

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            this.$noteTitle.prop("readonly", true);
        }
    }

    async beforeNoteSwitch({tabId}) {
        if (this.isTab(tabId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }
}