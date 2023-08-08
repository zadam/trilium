import NoteContextAwareWidget from "./../note_context_aware_widget.js";
import SwimlaneListRenderer from "./../../services/swimlane_list_renderer.js"

const TPL = `
<div class="swimlane-overview">
    <style>
    .swimlane-overview {
        font-family: var(--detail-font-family);
        padding-left: 14px;
        padding-top: 10px;
        height: 100%;
    }
    </style>
    
   
    <h3>Description</h3>
    
</div>
`;

export default class TaskOverviewTypeWidget extends NoteContextAwareWidget {
    static getType() { return "taskOverview"; }
    doRender() {
        this.$widget = $(TPL);

        super.doRender(); 
    }

    async noteTitleUpdatedEvent(e) {
        await this.$renderer?.taskTitleUpdatedEvent(e);
    }

    async taskUpdatedEvent(e) {
        if (Object.hasOwn(e, 'prop')) {
            await this.$renderer?.taskPropUpdatedEvent(e);
        }
    }

    isEnabled() {
        return super.isEnabled()
            // main note context should not be closeable
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "swimlane_dashboard");
    }

    async refreshWithNote(note) {
        
        if (note.type !== 'swimlane_dashboard') {
            this.$widget.empty();
            return;
        }

        this.$renderer = new SwimlaneListRenderer(this.$widget, note);
        await this.$renderer.renderList();
    }

    beforeUnloadEvent() {
        
    }
}