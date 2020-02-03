import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import treeCache from "../services/tree_cache.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";

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

export default class NoteTitleWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.spacedUpdate = new SpacedUpdate(async () => {
            const title = this.$noteTitle.val();

            await server.put(`notes/${this.noteId}/change-title`, {title});
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

    async refreshWithNote(note) {
        this.$noteTitle.val(note.title);

        this.$noteTitle.prop("readonly", note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable());
    }

    async beforeNoteSwitchListener({tabId}) {
        if (this.isTab(tabId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    async beforeTabRemoveListener({tabId}) {
        if (this.isTab(tabId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    focusOnTitleListener() {
        if (this.tabContext && this.tabContext.isActive()) {
            this.$noteTitle.trigger('focus');
        }
    }

    focusAndSelectTitleListener() {
        if (this.tabContext && this.tabContext.isActive()) {
            this.$noteTitle
                .trigger('focus')
                .trigger('select');
        }
    }

    beforeUnloadListener() {
        this.spacedUpdate.updateNowIfNecessary();
    }
}