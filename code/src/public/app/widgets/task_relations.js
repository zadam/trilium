import NoteContextAwareWidget from "./note_context_aware_widget.js";
import froca from "../services/froca.js";
import taskService from "../services/task.js";
import linkService from "../services/link.js";
const TPL = `
<div class="task-relations-widget">
    <style>
    .task-relations-widget {
        
    }

    .task-relations-widget-subtasks{
        display:grid;
        grid-template-columns: auto 150px;
        grid-auto-rows: auto;
        border: 1px solid black;
        padding-left:40px;
        cursor: pointer;
    }
    </style>
    <h3>Subtasks</h3>
    <div class="task-relations-widget-subtasks">
    </div>
</div>`;

export default class TaskRelationsWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "task") && (this.noteContext.note.children.length > 0);
    }

    doRender() {
        this.$widget = $(TPL);
        
        this.$list = this.$widget.find(".task-relations-widget-subtasks");

        super.doRender();
    }

    async refreshWithNote(note) {
        this.$list.empty();
        if (note.type !== 'task') {
            return;
        }
        
        for( const i in note.children ) {
            const child = await froca.getNote(note.children[i]);
            const attr = child.getAttribute("taskprop", "state");
            const value = taskService.getTaskStatusText(attr?.value);
            const item = $(`<div>${child.title}</div><div>${value}</div>`);
            item
                .addClass('block-link')
                .attr('data-href', `#${note.noteId}/${child.noteId}`)
                .on('click', e => linkService.goToLink(e));
            this.$list.append(item);
        }
        this.$widget.height(this.$list.height() + 50);
    }
}
