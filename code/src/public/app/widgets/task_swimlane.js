import NoteContextAwareWidget from "./note_context_aware_widget.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";
import froca from "../services/froca.js";
import task from "../services/task.js";
import server from "../services/server.js";
const TPL = `
<div class="task-swimlane-widget">
    <style>
    .task-swimlane-widget {
        height: 100%;
        display:flex; 
        flex-direction: row;
        padding-right: 30px;
    }
    .task-swimlane-widget-select {
        border: 0;
        min-width: 150px;
        width:100%;
        min-height: 40px;
    }

    .task-swimlane-widget p {
        padding-right: 5px; 
        margin: auto 0;
    }

    .task-swimlane-widget-select option {
        text-align:center;
    }

    </style>

    <p>Swimlane: </p>
    <select class="task-swimlane-widget-select"></select>
</div>`;

export default class TaskSwimlaneWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(async () => {
            if (!this.$selector || !this.$noteId) {
                return;
            }

            await froca.createAttribute(this.$noteId, {
                type: "taskprop",
                name: "swimlane",
                value: this.$selector.val()
            });

            await appContext.triggerEvent('taskUpdated', {
                taskId: this.$noteId,
                prop: "swimlane",
                newValue: this.$selector.val()
            });
        });

        this.deleteNoteOnEscape = false;

        appContext.addBeforeUnloadListener(this);
    }

    isEnabled() {
        return super.isEnabled() && this.noteContext && this.noteContext.note && (this.noteContext.note.type === "task");
    }

    doRender() {
        this.$widget = $(TPL);
        this.$selector = this.$widget.find(".task-swimlane-widget-select");

        this.$selector.on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async returnAllChildren(noteId) {
        const note = await froca.getNote(noteId);
        if (!note.children || note.children.length === 0) {
            return [];
        }

        const result = [];
        note.children.forEach(async child => {
            result.push(child);
            result.push(await this.returnAllChildren(child));
        });
        return result.flat();
    }

    async taskSwimlaneUpdatedEvent(e) {
        if (e.noteId !== this.$noteId) {
            return;
        }
        
        this.$selector.find(`option:contains("${e.newSwimlane}")`).prop('selected', true);
    }

    async refreshWithNote(note) {

        if (note.type !== 'task') {
            return;
        }
        this.$noteId = note.noteId;
        const main = await task.findMainBucket(note);
        if (main === null) {
            throw new Error('Could not find the main bucket');
        }

        const attrs = main.getAttributes();

        const doneBucket = attrs.find(a => a.name === 'doneTasksParent').value;
        const deprioBucket = attrs.find(a => a.name === 'deprioTasksParent').value;
        const dashboardBucket = attrs.find(a => a.name === 'dashboardParent').value;
        const defaultBucket = attrs.find(a => a.name === 'defaultBucketParent').value;
        const swimlane = note.getAttributes().find(a => a.name === "swimlane")?.value;

        const selected = (swimlane ?? defaultBucket) === "0" ? defaultBucket : swimlane;
        this.$selector.empty();

        const dashboard = await froca.getNote(dashboardBucket);

        this.$selector.append(`<option value="${defaultBucket}">Backlog</option>`);

        for (const i in dashboard.children) {
            const child = await froca.getNote(dashboard.children[i]);
            if ([doneBucket, deprioBucket, dashboardBucket, defaultBucket].includes(child.noteId)) {
                continue;
            }
            this.$selector.append(`<option value="${child.noteId}">${child.title}</option>`);
        }

        this.$selector.append(`<option value="${doneBucket}">Done</option>`);
        this.$selector.append(`<option value="${deprioBucket}">De-Prioritized</option>`);

        await this.spacedUpdate.allowUpdateWithoutChange(() => this.$selector.find(`option[value="${selected}"]`).prop('selected', true));

        if (swimlane !== selected) {
            this.spacedUpdate.scheduleUpdate();
        }
    }

    async beforeNoteSwitchEvent({ noteContext }) {
        if (this.isNoteContext(noteContext.ntxId)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    setProtectedStatus(note) {
        // this.$noteTitle.toggleClass("protected", !!note.isProtected);
    }

    async beforeNoteContextRemoveEvent({ ntxIds }) {
        if (this.isNoteContext(ntxIds)) {
            await this.spacedUpdate.updateNowIfNecessary();
        }
    }

    entitiesReloadedEvent({ loadResults }) {
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
