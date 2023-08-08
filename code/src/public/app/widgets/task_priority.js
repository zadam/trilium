import NoteContextAwareWidget from "./note_context_aware_widget.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";

export const TASK_PRIORITY = {
    NICE_TO_HAVE:   'nice_to_have',
    NORMAL:         'normal',
    URGENT:         'urgent',
    SHOW_STOPPER:   'show_stopper',
};


const TPL = `
<div class="task-prio-widget">
    <style>
    .task-prio-widget {
        min-width: 250px;
        height: 100%;
        display:flex; 
        flex-direction: row;
    }
    
    .task-prio-widget-select {
        border: 0;
        min-width: 5em;
    }

    .task-prio-widget-select option {
        text-align:center;
    }

    .task-prio-widget p {
        padding-right: 5px; 
        margin: auto 0;
    }
    
    </style>

    <p>Priority:</p>
    <select class="task-prio-widget-select">
    </select>
</div>`;

export default class TaskPriorityWidget extends NoteContextAwareWidget {
    constructor() {
        super();
        
        this.spacedUpdate = new SpacedUpdate(async () => {
            if (!this.$attrId) {
                return;
            }
            if (!this.$selector) {
                return;
            }
            
            await server.put(`notes/${this.$noteId}/attribute`, {
                attributeId: this.$attrId,
                type: "taskprop",
                name: "prio",
                value: this.$selector.val() 
            });

            await appContext.noteTreeWidget.triggerEvent('taskUpdated', {
                taskId: this.$noteId,
                prop: "priority",
                newValue: this.$selector.val()
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
        this.$selector = this.$widget.find(".task-prio-widget-select");

        this.$selector.empty();
        for(const [k, v] of Object.entries(TASK_PRIORITY)) {

            this.$selector.append(`<option value='${v}'>${k}</option>`);
        }
        
        this.$selector.on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async refreshWithNote(note) {
        this.$noteId = note.noteId;
        
        await server.get(`notes/${note.noteId}/attributes`).then(async (attributes) => {
            let attrId = '';
            for(const ind in attributes) {
                const attr = attributes[ind];
                if (attr.name == "prio") {
                    attrId = attr.attributeId;
                    await this.spacedUpdate.allowUpdateWithoutChange(() => this.$selector.find(`option[value="${attr.value}"`).prop('selected', true));
                    break;
                }
            }
            
            this.$attrId = attrId;
        });
    }
    
    setProtectedStatus(note) {
        // this.$noteTitle.toggleClass("protected", !!note.isProtected);
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

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            // not updating the title specifically since the synced title might be older than what the user is currently typing
            this.setProtectedStatus(this.note);
        }

        if (loadResults.isNoteReloaded(this.noteId, this.componentId)) {
            this.refresh();
        }
    }

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }
}
