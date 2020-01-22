import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import appContext from "../services/app_context.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import libraryLoader from "../services/library_loader.js";

const TPL = `
<div class="note-detail">
    <style>
    .note-detail {
        height: 100%;
    }  
    </style>
</div>
`;

const typeWidgetClasses = {
    'empty': "./type_widgets/empty.js",
    'text': "./type_widgets/text.js",
    'code': "./type_widgets/code.js",
    'file': "./type_widgets/file.js",
    'image': "./type_widgets/image.js",
    'search': "./type_widgets/search.js",
    'render': "./type_widgets/render.js",
    'relation-map': "./type_widgets/relation_map.js",
    'protected-session': "./type_widgets/protected_session.js",
    'book': "./type_widgets/book.js"
};

export default class NoteDetailWidget extends TabAwareWidget {
    constructor(appContext) {
        super(appContext);

        this.typeWidgets = {};
        this.typeWidgetPromises = {};

        this.spacedUpdate = new SpacedUpdate(async () => {
            const note = this.tabContext.note;
            note.content = this.getTypeWidget().getContent();

            const resp = await server.put('notes/' + note.noteId, note.dto);

            // FIXME: minor - does not propagate to other tab contexts with this note though
            note.dateModified = resp.dateModified;
            note.utcDateModified = resp.utcDateModified;

            this.trigger('noteChangesSaved', {noteId: note.noteId})
        });
    }

    doRender() {
        this.$widget = $(TPL);

        this.$widget.on("dragover", e => e.preventDefault());

        this.$widget.on("dragleave", e => e.preventDefault());

        this.$widget.on("drop", async e => {
            const activeNote = this.appContext.getActiveTabNote();

            if (!activeNote) {
                return;
            }

            const files = [...e.originalEvent.dataTransfer.files]; // chrome has issue that dataTransfer.files empties after async operation

            const importService = await import("../services/import.js");

            importService.uploadFiles(activeNote.noteId, files, {
                safeImport: true,
                shrinkImages: true,
                textImportedAsText: true,
                codeImportedAsCode: true,
                explodeArchives: true
            });
        });

        return this.$widget;
    }

    async refresh() {
        this.type = this.getWidgetType(/*disableAutoBook*/);

        if (!(this.type in this.typeWidgetPromises)) {
            this.typeWidgetPromises[this.type] = this.initWidgetType(this.type);
        }

        await this.typeWidgetPromises[this.type];

        for (const typeWidget of Object.values(this.typeWidgets)) {
            if (typeWidget.constructor.getType() !== this.type) {
                typeWidget.cleanup();
                typeWidget.toggle(false);
            }
        }

        this.getTypeWidget().toggle(true);

        this.setupClasses();
    }

    setupClasses() {
        for (const clazz of Array.from(this.$widget[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-detail') {
                this.$widget.removeClass(clazz);
            }
        }

        const note = this.tabContext.note;

        if (note) {
            this.$widget.addClass(note.cssClass);
            this.$widget.addClass(utils.getNoteTypeClass(note.type));
            this.$widget.addClass(utils.getMimeTypeClass(note.mime));

            this.$widget.toggleClass("protected", note.isProtected);
        }
    }

    getTypeWidget() {
        if (!this.typeWidgets[this.type]) {
            throw new Error("Could not find typeWidget for type: " + this.type);
        }

        return this.typeWidgets[this.type];
    }
    
    async initWidgetType(type) {
        const clazz = await import(typeWidgetClasses[type]);

        const typeWidget = this.typeWidgets[this.type] = new clazz.default(this.appContext);
        this.children.push(typeWidget);

        this.$widget.append(typeWidget.render());

        typeWidget.onNoteChange(() => this.spacedUpdate.scheduleUpdate());

        typeWidget.eventReceived('setTabContext', {tabContext: this.tabContext});
    }

    getWidgetType(disableAutoBook) {
        const note = this.tabContext.note;

        if (!note) {
            return "empty";
        }

        let type = note.type;

        if (type === 'text' && !disableAutoBook
            && utils.isHtmlEmpty(note.content)
            && note.hasChildren()) {

            type = 'book';
        }

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            type = 'protected-session';
        }

        return type;
    }

    async focusOnDetailListener({tabId}) {
        if (this.tabContext.tabId === tabId) {
            await this.refresh();

            const widget = this.getTypeWidget();
            widget.focus();
        }
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

    async printActiveNoteListener() {
        if (!this.tabContext.isActive()) {
            return;
        }

        await libraryLoader.requireLibrary(libraryLoader.PRINT_THIS);

        this.$widget.find('.note-detail-printable:visible').printThis({
            header: $("<h2>").text(this.tabContext.note && this.tabContext.note.title).prop('outerHTML') ,
            importCSS: false,
            loadCSS: [
                "libraries/codemirror/codemirror.css",
                "libraries/ckeditor/ckeditor-content.css"
            ],
            debug: true
        });
    }
}