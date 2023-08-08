import libraryLoader from "../../services/library_loader.js";
import utils from '../../services/utils.js';
import appContext from "../../components/app_context.js";
import BasicWidget from "../basic_widget.js";
import dialogService from "../../services/dialog.js";
import mimeTypesService from '../../services/mime_types.js';
import taskService from "../../services/task.js";
import froca from "../../services/froca.js";
const ENABLE_INSPECTOR = false;

const TPL = `
<div class="new-task-dialog modal fade mx-auto" tabindex="-1" role="dialog">
    <style>
        
        .new-task-dialog .new-task-dialog-textarea {
            min-height:300px;
            height:100%;
        }

        .new-task-dialog .new-task-dialog-prop-value {
            font-weight: 600;word-break: break-word;
        }
    </style>

    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Create a follow up task</h5>
                <button type="button" class="submit" aria-label="Create" style="margin-left: 0 !important;">Create Task</button>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body" style="width:100%">
                <div style="width:100%; display:grid; grid-template-columns: 100px auto 100px auto; grid-template-rows: auto;">
                    <p>Title: </p>
                    <input type="text" class="new-task-dialog-prop-value title" />
                    <!--p class="new-task-dialog-prop-value title">Follow up - ...</p-->
                    <p>Priority: </p>
                    <p class="new-task-dialog-prop-value priority">Normal</p>
                    <p>Deadline: </p>
                    <p class="new-task-dialog-prop-value deadline">...</h4>
                    <p>Swimlane: </p>
                    <p class="new-task-dialog-prop-value swimlane">Backlog</p>
                </div>
                <h5>Description</h5>
                <div class="new-task-dialog-textarea"></div>    
            </div>
        </div>
    </div>
</div>`;

export default class NewTaskDialog extends BasicWidget {
    constructor() {
        super();
    }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$editor = this.$widget.find('.new-task-dialog-textarea');
        this.$submit = this.$widget.find('.submit');

        this.$submit.on('click', async () => {
            const description = this.new_task_watchdog.editor.getData();
            await taskService.createNewTask(this.$parent, this.$widget.find('.title').val(), description, this.$deadline, this.$swimlane );
            utils.closeActiveDialog();
        });

        this.$widget.show();

        this.initialized = this.initEditor();

        super.doRender();
    }

    async createFollowUpEvent({parent = appContext.tabManager.getActiveContextNoteId()}) {
        this.$parent = parent;
        const parentNote = await froca.getNote(parent);
        const main = await taskService.findMainBucket(parentNote);
        if (main === null) {
            throw new Error('Could not find the main bucket');
        }

        const attrs = main.getAttributes();
        
        const defaultBucket = attrs.find(a => a.name === 'defaultBucketParent').value;

        if (this.new_task_watchdog?.editor) {
            this.new_task_watchdog.editor.setData('');
        }
        this.$title = "Follow up - " + utils.localNowDate();
        this.$priority = "normal";
        this.$deadline = utils.localDateInFutureDays(2);
        this.$swimlane = defaultBucket;
        this.$widget.find('.priority').html(this.$priority);
        this.$widget.find('.deadline').html(this.$deadline);
        this.$widget.find('.title').val(this.$title);
        
        utils.openDialog(this.$widget);
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CKEDITOR);

        const codeBlockLanguages = (await mimeTypesService.getMimeTypes()).filter(mt => mt.enabled).map(mt => ({
                        language: mt.mime.toLowerCase().replace(/[\W_]+/g,"-"),
                        label: mt.title
                    }));

        this.new_task_watchdog = new EditorWatchdog(BalloonEditor, {
            minimumNonErrorTimePeriod: 5000,
            crashNumberLimit: 3,
            saveInterval: 5000
        });

        this.new_task_watchdog.on('statusChange', () => {
            const currentState = this.new_task_watchdog.state;

            if (!['crashed', 'crashedPermanently'].includes(currentState)) {
                return;
            }

            console.log(`CKEditor changed to ${currentState}`);

            this.new_task_watchdog.crashes.forEach(crashInfo => console.log(crashInfo));

            if (currentState === 'crashedPermanently') {
                dialogService.info(`Editing component keeps crashing. Please try restarting Trilium. If problem persists, consider creating a bug report.`);

                this.new_task_watchdog.editor.enableReadOnlyMode('crashed-editor');
            }
        });

        this.new_task_watchdog.setCreator(async (elementOrData, editorConfig) => {
            const editor = await BalloonEditor.create(elementOrData, editorConfig);

            if (glob.isDev && ENABLE_INSPECTOR) {
                await import(/* webpackIgnore: true */'../../../libraries/ckeditor/inspector.js');
                CKEditorInspector.attach(editor);
            }

            return editor;
        });


        await this.new_task_watchdog.create(this.$editor[0], {
            placeholder: "The task description goes here...",
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
        return this.new_task_watchdog?.editor;
    }

    cleanup() {
        if (this.new_task_watchdog?.editor) {
            this.new_task_watchdog.editor.setData('');
        }
    }

    insertDateTimeToTextCommand() {
        const date = new Date();
        const dateString = utils.formatDateTime(date);

        this.addTextToEditor(dateString);
    }

    async addLinkToEditor(linkHref, linkTitle) {
        await this.initialized;

        this.new_task_watchdog.editor.model.change(writer => {
            const insertPosition = this.new_task_watchdog.editor.model.document.selection.getFirstPosition();
            writer.insertText(linkTitle, {linkHref: linkHref}, insertPosition);
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
        const model = this.new_task_watchdog.editor.model;
        const selection = model.document.selection;

        return !selection.isCollapsed;
    }

    async executeWithTextEditorEvent({callback, resolve, ntxId}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        await this.initialized;

        if (callback) {
            callback(this.new_task_watchdog.editor);
        }

        resolve(this.new_task_watchdog.editor);
    }

    beforeUnloadEvent() {
    }

    async addTextToEditor(text) {
        await this.initialized;

        this.new_task_watchdog.editor.model.change(writer => {
            const insertPosition = this.new_task_watchdog.editor.model.document.selection.getLastPosition();
            writer.insertText(text, insertPosition);
        });
    }

    async addLink(notePath, linkTitle) {
        await this.initialized;

        if (linkTitle) {
            if (this.hasSelection()) {
                this.new_task_watchdog.editor.execute('link', `#${notePath}`);
            } else {
                await this.addLinkToEditor(`#${notePath}`, linkTitle);
            }
        }
        else {
            this.new_task_watchdog.editor.execute('referenceLink', { href: '#' + notePath });
        }

        this.new_task_watchdog.editor.editing.view.focus();
    }

}
