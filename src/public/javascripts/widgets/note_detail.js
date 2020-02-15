import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import libraryLoader from "../services/library_loader.js";
import EmptyTypeWidget from "./type_widgets/empty.js";
import TextTypeWidget from "./type_widgets/text.js";
import CodeTypeWidget from "./type_widgets/code.js";
import FileTypeWidget from "./type_widgets/file.js";
import ImageTypeWidget from "./type_widgets/image.js";
import SearchTypeWidget from "./type_widgets/search.js";
import RenderTypeWidget from "./type_widgets/render.js";
import RelationMapTypeWidget from "./type_widgets/relation_map.js";
import ProtectedSessionTypeWidget from "./type_widgets/protected_session.js";
import BookTypeWidget from "./type_widgets/book.js";

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
    'empty': EmptyTypeWidget,
    'text': TextTypeWidget,
    'code': CodeTypeWidget,
    'file': FileTypeWidget,
    'image': ImageTypeWidget,
    'search': SearchTypeWidget,
    'render': RenderTypeWidget,
    'relation-map': RelationMapTypeWidget,
    'protected-session': ProtectedSessionTypeWidget,
    'book': BookTypeWidget
};

export default class NoteDetailWidget extends TabAwareWidget {
    constructor(appContext, parent) {
        super(appContext, parent);

        this.typeWidgets = {};

        this.spacedUpdate = new SpacedUpdate(async () => {
            const {note} = this.tabContext;
            const {noteId} = note;

            const dto = note.dto;
            dto.content = this.getTypeWidget().getContent();

            await server.put('notes/' + noteId, dto, this.componentId);
        });
    }

    doRender() {
        this.$widget = $(TPL);

        this.$widget.on("dragover", e => e.preventDefault());

        this.$widget.on("dragleave", e => e.preventDefault());

        this.$widget.on("drop", async e => {
            const activeNote = this.tabManager.getActiveTabNote();

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
        if (!this.isEnabled()) {
            this.toggle(false);
            return;
        }

        this.toggle(true);

        this.type = await this.getWidgetType();

        if (!(this.type in this.typeWidgets)) {
            const clazz = typeWidgetClasses[this.type];

            const typeWidget = this.typeWidgets[this.type] = new clazz(this.appContext, this);
            typeWidget.spacedUpdate = this.spacedUpdate;

            this.children.push(typeWidget);
            this.$widget.append(typeWidget.render());

            typeWidget.eventReceived('setTabContext', {tabContext: this.tabContext});
        }

        this.setupClasses();
    }

    setupClasses() {
        for (const clazz of Array.from(this.$widget[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-detail') {
                this.$widget.removeClass(clazz);
            }
        }

        const note = this.note;

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

    async getWidgetType() {
        const note = this.note;

        if (!note) {
            return "empty";
        }

        let type = note.type;

        if (type === 'text' && !this.tabContext.autoBookDisabled
            && note.hasChildren()
            && utils.isDesktop()) {

            const noteComplement = await this.tabContext.getNoteComplement();

            if (utils.isHtmlEmpty(noteComplement.content)) {
                type = 'book';
            }
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
            header: $("<h2>").text(this.note && this.note.title).prop('outerHTML') ,
            importCSS: false,
            loadCSS: [
                "libraries/codemirror/codemirror.css",
                "libraries/ckeditor/ckeditor-content.css"
            ],
            debug: true
        });
    }

    hoistedNoteChangedListener() {
        this.refresh();
    }

    async entitiesReloadedListener({loadResults}) {
        // we should test what happens when the loaded note is deleted

        if (loadResults.isNoteContentReloaded(this.noteId, this.componentId)) {
            this.refreshWithNote(this.note, this.notePath);
        }
    }

    beforeUnloadListener() {
        this.spacedUpdate.updateNowIfNecessary();
    }

    autoBookDisabledListener() {
        this.refresh();
    }

    async triggerChildren(name, data) {
        // done manually in refresh()
        if (name !== 'setTabContext') {
            await super.triggerChildren(name, data);
        }
    }
}