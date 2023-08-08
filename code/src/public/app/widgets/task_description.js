import libraryLoader from "../services/library_loader.js";
import mimeTypesService from '../services/mime_types.js';
import noteAutocompleteService from '../services/note_autocomplete.js';
import NoteContextAwareWidget from './note_context_aware_widget.js'
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";
import server from "../services/server.js";
const ENABLE_INSPECTOR = false;

const TPL = `
<div class="task-description-widget note-detail-printable">
    <style>
    .task-description-widget {
    }

    .task-description-widget task-description-widget-textarea{
       min-height:300px;
       height:100%;
    }
    </style>
    
    <h3>Description</h3>
    <div class="task-description-widget-textarea"></div>
    
</div>`;

const mentionSetup = {
    feeds: [
        {
            marker: '@',
            feed: queryText => noteAutocompleteService.autocompleteSourceForCKEditor(queryText),
            itemRenderer: item => {
                const itemElement = document.createElement('button');

                itemElement.innerHTML = `${item.highlightedNotePathTitle} `;

                return itemElement;
            },
            minimumCharacters: 0
        }
    ]
};

export default class TaskDescriptionWidget extends NoteContextAwareWidget {
    constructor() {
        super();
        
        this.spacedUpdate = new SpacedUpdate(async () => {
            if (!this.$attrId) {
                return;
            }

            const content = this.watchdog.editor.getData();
            if (!this.$attrId){
                return;
            }
            await server.put(`notes/${this.$noteId}/attribute`, {
                attributeId: this.$attrId,
                type: "taskprop",
                name: "description",
                value: content 
            });
        });

        this.deleteNoteOnEscape = false;

        appContext.addBeforeUnloadListener(this);
    }
    isEnabled() {
        return super.isEnabled()
            // main note context should not be closeable
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "task");
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$editor = this.$widget.find('.task-description-widget-textarea');
        
        this.$widget.show();

        this.initialized = this.initEditor();

        super.doRender();
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        const codeBlockLanguages = (await mimeTypesService.getMimeTypes()).filter(mt => mt.enabled).map(mt => ({
                        language: mt.mime.toLowerCase().replace(/[\W_]+/g,"-"),
                        label: mt.title
                    }));

        this.watchdog = new EditorWatchdog(BalloonEditor, {
            minimumNonErrorTimePeriod: 5000,
            crashNumberLimit: 3,
            saveInterval: 5000
        });

        this.watchdog.on('statusChange', () => {
            const currentState = this.watchdog.state;

            if (!['crashed', 'crashedPermanently'].includes(currentState)) {
                return;
            }

            console.log(`CKEditor changed to ${currentState}`);

            this.watchdog.crashes.forEach(crashInfo => console.log(crashInfo));

            if (currentState === 'crashedPermanently') {
                dialogService.info(`Editing component keeps crashing. Please try restarting Trilium. If problem persists, consider creating a bug report.`);

                this.watchdog.editor.enableReadOnlyMode('crashed-editor');
            }
        });

        this.watchdog.setCreator(async (elementOrData, editorConfig) => {
            const editor = await BalloonEditor.create(elementOrData, editorConfig);

            editor.model.document.on('change:data', () => this.spacedUpdate.scheduleUpdate());

            if (glob.isDev && ENABLE_INSPECTOR) {
                await import(/* webpackIgnore: true */'../../../libraries/ckeditor/inspector.js');
                CKEditorInspector.attach(editor);
            }

            return editor;
        });


        await this.watchdog.create(this.$editor[0], {
            placeholder: "The task description goes here...",
            mention: mentionSetup,
            codeBlock: {
                languages: codeBlockLanguages
            },
            math: {
                engine: 'katex',
                outputType: 'span', // or script
                lazyLoad: async () => await libraryLoader.requireLibrary(libraryLoader.KATEX),
                forceOutputType: false, // forces output to use outputType
                enablePreview: true // Enable preview view
            }
        });
    }
    
    show() {}

    getEditor() {
        return this.watchdog?.editor;
    }

    cleanup() {
        if (this.watchdog?.editor) {
            this.spacedUpdate.allowUpdateWithoutChange(() => {
                this.watchdog.editor.setData('');
            });
        }
    }

    insertDateTimeToTextCommand() {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        this.addTextToEditor(dateString);
    }

    async addLinkToEditor(linkHref, linkTitle) {
        await this.initialized;

        this.watchdog.editor.model.change(writer => {
            const insertPosition = this.watchdog.editor.model.document.selection.getFirstPosition();
            writer.insertText(linkTitle, {linkHref: linkHref}, insertPosition);
        });
    }

    async addTextToEditor(text) {
        await this.initialized;

        this.watchdog.editor.model.change(writer => {
            const insertPosition = this.watchdog.editor.model.document.selection.getLastPosition();
            writer.insertText(text, insertPosition);
        });
    }

    async addLink(notePath, linkTitle) {
        await this.initialized;

        if (linkTitle) {
            if (this.hasSelection()) {
                this.watchdog.editor.execute('link', `#${notePath}`);
            } else {
                await this.addLinkToEditor(`#${notePath}`, linkTitle);
            }
        }
        else {
            this.watchdog.editor.execute('referenceLink', { href: '#' + notePath });
        }

        this.watchdog.editor.editing.view.focus();
    }

    async refreshWithNote(note) {

        this.$noteId = note.noteId;
        
        server.get(`notes/${note.noteId}/attributes`).then(async (attributes) => {
            let attrId = '';
            for(const ind in attributes) {
                const attr = attributes[ind];
                if (attr.name == "description") {
                    attrId = attr.attributeId;
                    await this.spacedUpdate.allowUpdateWithoutChange(() =>
            this.watchdog.editor.setData(attr.value));
                    break;
                }
            }
            
            this.$attrId = attrId;
        });
        
    }

    addTextToActiveEditorEvent({text}) {
        if (!this.isActive()) {
            return;
        }

        this.addTextToEditor(text);
    }

    // returns true if user selected some text, false if there's no selection
    hasSelection() {
        const model = this.watchdog.editor.model;
        const selection = model.document.selection;

        return !selection.isCollapsed;
    }

    async executeWithTextEditorEvent({callback, resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        if (callback) {
            callback(this.watchdog.editor);
        }

        resolve(this.watchdog.editor);
    }

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }
}
