import NoteContextAwareWidget from "./note_context_aware_widget.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";
import taskService from "../services/task.js";
import utils from "../services/utils.js";

const TPL = `
<div class="note-new-task-widget">
    <style>
    .note-new-task-widget {
        min-height: 100px;
    }
    
    .note-new-task-widget-new-comment{
        width: 100%;
    }
    </style>
    <h3>Create a follow up task</h3>
    <textarea class="note-new-task-widget-new-comment" placeholder="Type your description here..." value=""></textarea>
</div>`;

export default class TaskCreationForNoteWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(async () => {
          
            protectedSessionHolder.touchProtectedSessionIfNecessary(this.note);

        });

        this.deleteNoteOnEscape = false;

        appContext.addBeforeUnloadListener(this);
    }

    isEnabled() {
        return super.isEnabled()
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type === "text");
    }

    doRender() {
        this.$widget = $(TPL);
        const input = this.$widget.find('.note-new-task-widget-new-comment');

        input.on('keydown',async (e) => {
            if (e.code === 'Enter' && !e.shiftKey) {
                const description = input.val();
                input.val('');
                await this.createNewTask(description);
            }
        });
        super.doRender();
    }

    async createNewTask(description) {
        const note = appContext.tabManager.getActiveContextNote();

        if (!note) {
            return;
        }
        
        await taskService.createNewTask(appContext.tabManager.getActiveContextNotePath(), "Follow up - " + utils.localNowDate(), description, "default", utils.localNowDate(), '');
    }

    async refreshWithNote(note) {
        if (note.type !== "text") {
            this.$note = null;
            return;   
        }
        
        this.$note = note;
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
            
        }
    }

    focusAndSelectTitleEvent({isNewNote} = {isNewNote: false}) {
        if (this.noteContext && this.noteContext.isActive()) {
            

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

    setProtectedStatus(note) {
        
    }

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }
}
