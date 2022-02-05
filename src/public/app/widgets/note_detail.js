import NoteContextAwareWidget from "./note_context_aware_widget.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import libraryLoader from "../services/library_loader.js";
import EmptyTypeWidget from "./type_widgets/empty.js";
import EditableTextTypeWidget from "./type_widgets/editable_text.js";
import EditableCodeTypeWidget from "./type_widgets/editable_code.js";
import FileTypeWidget from "./type_widgets/file.js";
import ImageTypeWidget from "./type_widgets/image.js";
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
import NoneTypeWidget from "./type_widgets/none.js";
import attributeService from "../services/attributes.js";
import NoteMapTypeWidget from "./type_widgets/note_map.js";
import attributeRenderer from "../services/attribute_renderer.js";

const TPL = `
<div class="note-detail">
    <style>
    .note-detail {
        font-family: var(--detail-font-family);
        font-size: var(--detail-font-size);
    }
    
    .note-detail.full-height {
        height: 100%;
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
    'search': NoneTypeWidget,
    'render': RenderTypeWidget,
    'relation-map': RelationMapTypeWidget,
    'protected-session': ProtectedSessionTypeWidget,
    'book': BookTypeWidget,
    'note-map': NoteMapTypeWidget
};

export default class NoteDetailWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.typeWidgets = {};

        this.spacedUpdate = new SpacedUpdate(async () => {
            const {note} = this.noteContext;
            const {noteId} = note;

            const dto = note.dto;
            dto.content = this.getTypeWidget().getContent();

            // for read only notes
            if (dto.content === undefined) {
                return;
            }

            protectedSessionHolder.touchProtectedSessionIfNecessary(note);

            await server.put('notes/' + noteId, dto, this.componentId);
        });

        appContext.addBeforeUnloadListener(this);
    }

    isEnabled() {
        return true;
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();

        this.$widget.on("dragover", e => e.preventDefault());

        this.$widget.on("dragleave", e => e.preventDefault());

        this.$widget.on("drop", async e => {
            const activeNote = appContext.tabManager.getActiveContextNote();

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
                explodeArchives: true,
                replaceUnderscoresWithSpaces: true
            });
        });
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

            await typeWidget.handleEvent('setNoteContext', {noteContext: this.noteContext});

            // this is happening in update() so note has been already set, and we need to reflect this
            await typeWidget.handleEvent('noteSwitched', {
                noteContext: this.noteContext,
                notePath: this.noteContext.notePath
            });

            this.child(typeWidget);
        }

        this.checkFullHeight();
    }

    checkFullHeight() {
        // https://github.com/zadam/trilium/issues/2522
        this.$widget.toggleClass("full-height",
            !this.noteContext.hasNoteList()
            && ['editable-text', 'editable-code'].includes(this.type));
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

        if (type === 'text' && await this.noteContext.isReadOnly()) {
            type = 'read-only-text';
        }

        if ((type === 'code' || type === 'mermaid') && await this.noteContext.isReadOnly()) {
            type = 'read-only-code';
        }

        if (type === 'text') {
            type = 'editable-text';
        }

        if (type === 'code' || type === 'mermaid') {
            type = 'editable-code';
        }

        if (note.isProtected && !protectedSessionHolder.isProtectedSessionAvailable()) {
            type = 'protected-session';
        }

        return type;
    }

    async focusOnDetailEvent({ntxId}) {
        if (this.noteContext.ntxId === ntxId) {
            await this.refresh();

            const widget = this.getTypeWidget();
            await widget.initialized;
            widget.focus();
        }
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

    async printActiveNoteEvent() {
        if (!this.noteContext.isActive()) {
            return;
        }

        await libraryLoader.requireLibrary(libraryLoader.PRINT_THIS);

        let $promotedAttributes = $("");

        if (this.note.getPromotedDefinitionAttributes().length > 0) {
            $promotedAttributes = (await attributeRenderer.renderNormalAttributes(this.note)).$renderedAttributes;
        }

        this.$widget.find('.note-detail-printable:visible').printThis({
            header: $("<div>")
                        .append($("<h2>").text(this.note.title))
                        .append($promotedAttributes)
                        .prop('outerHTML'),
            footer: `
<script src="libraries/katex/katex.min.js"></script>
<script src="libraries/katex/mhchem.min.js"></script>
<script src="libraries/katex/auto-render.min.js"></script>
<script>
    document.body.className += ' ck-content printed-content';
    
    renderMathInElement(document.body, {trust: true});
</script>
`,
            importCSS: false,
            loadCSS: [
                "libraries/codemirror/codemirror.css",
                "libraries/ckeditor/ckeditor-content.css",
                "libraries/bootstrap/css/bootstrap.min.css",
                "libraries/katex/katex.min.css",
                "stylesheets/print.css",
                "stylesheets/relation_map.css",
                "stylesheets/ckeditor-theme.css"
            ],
            debug: true
        });
    }

    hoistedNoteChangedEvent({ntxId}) {
        if (this.isNoteContext(ntxId)) {
            this.refresh();
        }
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
                && ['readOnly', 'autoReadOnlyDisabled', 'cssClass', 'displayRelations', 'hideRelations'].includes(attr.name)
                && attributeService.isAffecting(attr, this.note));

            const relation = attrs.find(attr =>
                attr.type === 'relation'
                && ['template', 'renderNote'].includes(attr.name)
                && attributeService.isAffecting(attr, this.note));

            if (label || relation) {
                // probably incorrect event
                // calling this.refresh() is not enough since the event needs to be propagated to children as well
                this.handleEvent('noteTypeMimeChanged', {noteId: this.noteId});
            }
        }
    }

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }

    readOnlyTemporarilyDisabledEvent({noteContext}) {
        if (this.isNoteContext(noteContext.ntxId)) {
            this.refresh();
        }
    }

    async cutIntoNoteCommand() {
        const note = appContext.tabManager.getActiveContextNote();

        if (!note) {
            return;
        }

        // without await as this otherwise causes deadlock through component mutex
        noteCreateService.createNote(appContext.tabManager.getActiveContextNotePath(), {
            isProtected: note.isProtected,
            saveSelection: true
        });
    }

    // used by cutToNote in CKEditor build
    async saveNoteDetailNowCommand() {
        await this.spacedUpdate.updateNowIfNecessary();
    }

    renderActiveNoteEvent() {
        if (this.noteContext.isActive()) {
            this.refresh();
        }
    }
}
