import TabAwareWidget from "./tab_aware_widget.js";
import utils from "../services/utils.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import libraryLoader from "../services/library_loader.js";
import EmptyTypeWidget from "./type_widgets/empty.js";
import EditableTextTypeWidget from "./type_widgets/editable_text.js";
import EditableCodeTypeWidget from "./type_widgets/editable_code.js";
import FileTypeWidget from "./type_widgets/file.js";
import ImageTypeWidget from "./type_widgets/image.js";
import SearchTypeWidget from "./type_widgets/search.js";
import RenderTypeWidget from "./type_widgets/render.js";
import RelationMapTypeWidget from "./type_widgets/relation_map.js";
import ProtectedSessionTypeWidget from "./type_widgets/protected_session.js";
import BookTypeWidget from "./type_widgets/book.js";
import appContext from "../services/app_context.js";
import keyboardActionsService from "../services/keyboard_actions.js";
import noteCreateService from "../services/note_create.js";
import DeletedTypeWidget from "./type_widgets/deleted.js";
import ReadOnlyTextTypeWidget from "./type_widgets/read_only_text.js";
import ReadOnlyCodeTypeWidget from "./type_widgets/read_only_code.js";

const TPL = `
<div class="note-detail">
    <style>
    .note-detail {
        height: 100%;
        min-height: 0;
        font-family: var(--detail-font-family);
        font-size: var(--detail-font-size);
    }
    </style>
</div>
`;

const typeWidgetClasses = {
    'empty': EmptyTypeWidget,
    'deleted': DeletedTypeWidget,
    'editable-text': EditableTextTypeWidget,
    'read-only-text': ReadOnlyTextTypeWidget,
    'editable-code': EditableCodeTypeWidget,
    'read-only-code': ReadOnlyCodeTypeWidget,
    'file': FileTypeWidget,
    'image': ImageTypeWidget,
    'search': SearchTypeWidget,
    'render': RenderTypeWidget,
    'relation-map': RelationMapTypeWidget,
    'protected-session': ProtectedSessionTypeWidget,
    'book': BookTypeWidget
};

export default class NoteDetailWidget extends TabAwareWidget {
    constructor() {
        super();

        this.typeWidgets = {};

        this.spacedUpdate = new SpacedUpdate(async () => {
            const {note} = this.tabContext;
            const {noteId} = note;

            const dto = note.dto;
            dto.content = this.getTypeWidget().getContent();

            protectedSessionHolder.touchProtectedSessionIfNecessary(note);

            await server.put('notes/' + noteId, dto, this.componentId);
        });
    }

    isEnabled() {
        return true;
    }

    doRender() {
        this.$widget = $(TPL);

        this.$widget.on("dragover", e => e.preventDefault());

        this.$widget.on("dragleave", e => e.preventDefault());

        this.$widget.on("drop", async e => {
            const activeNote = appContext.tabManager.getActiveTabNote();

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
        this.type = await this.getWidgetType();
        this.mime = this.note ? this.note.mime : null;

        if (!(this.type in this.typeWidgets)) {
            const clazz = typeWidgetClasses[this.type];

            const typeWidget = this.typeWidgets[this.type] = new clazz();
            typeWidget.spacedUpdate = this.spacedUpdate;
            typeWidget.setParent(this);

            const $renderedWidget = typeWidget.render();
            keyboardActionsService.updateDisplayedShortcuts($renderedWidget);

            this.$widget.append($renderedWidget);

            await typeWidget.handleEvent('setTabContext', {tabContext: this.tabContext});

            // this is happening in update() so note has been already set and we need to reflect this
            await typeWidget.handleEvent('tabNoteSwitched', {
                tabContext: this.tabContext,
                notePath: this.tabContext.notePath
            });

            this.child(typeWidget);
        }

        this.setupClasses();
    }

    setupClasses() {
        for (const clazz of Array.from(this.$widget[0].classList)) { // create copy to safely iterate over while removing classes
            if (clazz !== 'note-detail' && !clazz.startsWith('hidden-')) {
                this.$widget.removeClass(clazz);
            }
        }

        const note = this.note;

        if (note) {
            this.$widget.addClass(note.getCssClass());

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
        } else if (note.isDeleted) {
            return "deleted";
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

        if (type === 'text' && !this.tabContext.textPreviewDisabled) {
            const noteComplement = await this.tabContext.getNoteComplement();

            if (note.hasLabel('readOnly') ||
                (noteComplement.content
                    && noteComplement.content.length > 10000)
                    && !note.hasLabel('autoReadOnlyDisabled')) {
                type = 'read-only-text';
            }
        }

        if (type === 'code' && !this.tabContext.codePreviewDisabled) {
            const noteComplement = await this.tabContext.getNoteComplement();

            if (note.hasLabel('readOnly') ||
                (noteComplement.content
                    && noteComplement.content.length > 30000)
                    && !note.hasLabel('autoReadOnlyDisabled')) {
                type = 'read-only-code';
            }
        }

        if (type === 'text') {
            type = 'editable-text';
        }

        if (type === 'code') {
            type = 'editable-code';
        }

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            type = 'protected-session';
        }

        return type;
    }

    async focusOnDetailEvent({tabId}) {
        if (this.tabContext.tabId === tabId) {
            await this.refresh();

            const widget = this.getTypeWidget();
            widget.focus();
        }
    }

    async beforeNoteSwitchEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    async beforeTabRemoveEvent({tabId}) {
        if (this.isTab(tabId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    async printActiveNoteEvent() {
        if (!this.tabContext.isActive()) {
            return;
        }

        await libraryLoader.requireLibrary(libraryLoader.PRINT_THIS);

        this.$widget.find('.note-detail-printable:visible').printThis({
            header: $("<h2>").text(this.note && this.note.title).prop('outerHTML'),
            footer: "<script>document.body.className += ' ck-content';</script>",
            importCSS: false,
            loadCSS: [
                "libraries/codemirror/codemirror.css",
                "libraries/ckeditor/ckeditor-content.css",
                "libraries/ckeditor/ckeditor-content.css",
                "libraries/bootstrap/css/bootstrap.min.css",
                "stylesheets/print.css",
                "stylesheets/relation_map.css",
                "stylesheets/themes.css",
                "stylesheets/detail.css"
            ],
            debug: true
        });
    }

    hoistedNoteChangedEvent() {
        this.refresh();
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId, this.componentId)
            || (loadResults.isNoteReloaded(this.noteId, this.componentId) && (this.type !== await this.getWidgetType() || this.mime !== this.note.mime))) {

            this.handleEvent('noteTypeMimeChanged', {noteId: this.noteId});
        }
        else {
            const attrs = loadResults.getAttributes();

            const label = attrs.find(attr =>
                attr.type === 'label'
                && ['readOnly', 'autoReadOnlyDisabled', 'cssClass', 'bookZoomLevel'].includes(attr.name)
                && attr.isAffecting(this.note));

            const relation = attrs.find(attr =>
                attr.type === 'relation'
                && ['template', 'renderNote'].includes(attr.name)
                && attr.isAffecting(this.note));

            if (label || relation) {
                // probably incorrect event
                // calling this.refresh() is not enough since the event needs to be propagated to children as well
                this.handleEvent('noteTypeMimeChanged', {noteId: this.noteId});
            }
        }
    }

    beforeUnloadEvent() {
        this.spacedUpdate.updateNowIfNecessary();
    }

    autoBookDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }

    textPreviewDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }

    codePreviewDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }

    async cutIntoNoteCommand() {
        const note = appContext.tabManager.getActiveTabNote();

        if (!note) {
            return;
        }

        // without await as this otherwise causes deadlock through component mutex
        noteCreateService.createNote(note.noteId, {
            isProtected: note.isProtected,
            saveSelection: true
        });
    }
}
