import NoteContextAwareWidget from "./note_context_aware_widget.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";

const TPL = `
<div class="task-deadline-widget">
    <style>
    .task-deadline-widget {
        height: 100%;
        width: 250px;
        display:flex; 
        flex-direction: row;
    }

    .task-deadline-widget-input {
        background-color: transparent;
    }

    .task-deadline-widget p {
        padding-right: 5px; 
        margin: auto 0;
    }

    </style>
    <p>Deadline:</p>
    <input type="date" class="task-deadline-widget-input" min="${dayjs().format('YYYY-MM-DD')}">
</div>`;

export default class TaskDeadlineWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(async () => {
            if (!this.$attrId) {
                return;
            }

            const deadline = this.$widget.find(".task-deadline-widget-input").val();

            await server.put(`notes/${this.$noteId}/attribute`, {
                attributeId: this.$attrId,
                type: "taskprop",
                name: "deadline",
                value: deadline
            });

            await appContext.triggerEvent('taskUpdated', {
                taskId: this.$noteId,
                prop: "deadline",
                newValue: deadline
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
        
        this.$widget.find(".task-deadline-widget-input").on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async refreshWithNote(note) {
        
        this.$widget.find(".task-deadline-widget-input").val('');
        
        if (note.type !== 'task') {
            return;
        }
        this.$noteId = note.noteId;
        await server.get(`notes/${note.noteId}/attributes`).then(async (attributes) => {
            let attrId = '';
            for(const ind in attributes) {
                const attr = attributes[ind];
                if (attr.name == "deadline") {
                    attrId = attr.attributeId;
                    if (attr.value !== undefined && attr.value !== '1999-01-01') {
                        this.$widget.find(".task-deadline-widget-input").val(attr.value);
                    } 
                    break;
                }
            }
            
            this.$attrId = attrId;
        });
    }

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }
}
