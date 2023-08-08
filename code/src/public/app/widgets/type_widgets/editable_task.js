import AbstractTaskTypeWidget from "./abstract_task_type_widget.js";

export default class EditableTaskTypeWidget extends AbstractTaskTypeWidget {
    static getType() { return "editableTask"; }
    doRender() {
        this.$widget = $('<div></div>');

        super.doRender(); 
    }    
}
import NoteContextAwareWidget from "../note_context_aware_widget.js";
import taskService from "../../services/task.js";
import froca from "../../services/froca.js";
import appContext from "../../components/app_context.js";

export default class EditableTaskTypeWidget extends NoteContextAwareWidget {
    static getType() { return "editableTask"; }
    doRender() {
        this.$widget = $('<div></div>');

        super.doRender(); 
    }
    
    isEnabled() {
        super.isEnabled()
            // main note context should not be closeable
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "task");
    }

    async markAsDoneEvent({activeNote = appContext.tabManager.getActiveContextNoteId()}) {
        
        const note = await froca.getNote(activeNote);

        await taskService.markTaskAsDone(note);

        await appContext.triggerEvent('taskStatusUpdated', {
            noteId: note.noteId,
            newStatus: 'done'
        });
        await appContext.triggerEvent('taskSwimlaneUpdated', {
            noteId: note.noteId,
            newSwimlane: 'Done'
        });
    }
}