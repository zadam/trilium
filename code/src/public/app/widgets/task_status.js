import NoteContextAwareWidget from "./note_context_aware_widget.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";
import server from "../services/server.js";
import utils from './../services/utils.js';

const TASK_STATUS = {
    NOT_STARTED:    "default",
    IN_PROGRESS:    "in_progress",
    POSTPONED:      "postponed",
    BLOCKED:        "blocked",
    DONE:           "done",
}

const TPL = `
<div class="task-status-widget">
    <style>
    .task-status-widget {
        width:250px;
        height: 100%;
        display:flex; 
        flex-direction: row;
    }

    .task-status-widget-select {
        border: 0;
        min-width: 150px;
        width:100%;
        min-height: 40px;
    }

    .task-status-widget-select option {
        text-align:center;
    }

    .task-status-widget p {
        padding-right: 5px; 
        margin: auto 0;
    }

    </style>
    <p>Status: </p>
    <select class="task-status-widget-select"></select>
</div>`;

export default class TaskStatusWidget extends NoteContextAwareWidget {
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
                name: "state",
                value: this.$selector.val()
            });

            await appContext.triggerEvent('taskUpdated', {
                taskId: this.$noteId,
                prop: "state",
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
        this.$selector = this.$widget.find(".task-status-widget-select");

        for(const [k, v] of Object.entries(TASK_STATUS)) {

            this.$selector.append(`<option value='${v}'>${k}</option>`);
        }
        
        this.$selector.on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async taskStatusUpdatedEvent(e) {

        if (e.noteId !== this.$noteId) {
            return;
        }

        this.$selector.find(`option[value="${e.newStatus}"]`).prop('selected', true);
    }

    async refreshWithNote(note) {
        this.$noteId = note.noteId;
        
        await server.get(`notes/${note.noteId}/attributes`).then(async (attributes) => {
            let attrId = '';
            for(const ind in attributes) {
                const attr = attributes[ind];
                if (attr.name == "state") {
                    attrId = attr.attributeId;
                    await this.spacedUpdate.allowUpdateWithoutChange(() => this.$selector.find(`option[value="${attr.value}"]`).prop('selected', true));
                    break;
                }
            }
            
            this.$attrId = attrId;
        });
    }

    async beforeNoteSwitchEvent({noteContext}) {
        if (this.isNoteContext(noteContext.ntxId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    setProtectedStatus(note) {
        // this.$noteTitle.toggleClass("protected", !!note.isProtected);
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
