import NoteContextAwareWidget from "./note_context_aware_widget.js";
import protectedSessionHolder from "../services/protected_session_holder.js";
import server from "../services/server.js";
import SpacedUpdate from "../services/spaced_update.js";
import appContext from "../components/app_context.js";
import utils from './../services/utils.js';

const TPL = `
<div class="task-comments-widget">
    <style>
    .task-comments-widget {
        min-height: 100px;
    }
    
    .task-comments-widget task-comments-widget-container {
        display:flex;
        font-size: 180%;
        border: 0;
        min-width: 5em;
        width: 100%;
    }
    
    .task-comments-widget input.new-comment {
        width: 100%;
    }

    .new-comment {
        background:transparent;
        width:100%;
    }
    
    .task-comments-widget input.note-title.protected {
        text-shadow: 4px 4px 4px var(--muted-text-color);
    }
    </style>
    <h3>Comments</h3>
    <textarea class="new-comment" placeholder="Type your comment here..." value=""></textarea>
    <div class="task-comments-widget-container"></div>
</div>`;

export default class TaskCommentsWidget extends NoteContextAwareWidget {
    constructor() {
        super();

        this.spacedUpdate = new SpacedUpdate(async () => {
          
            protectedSessionHolder.touchProtectedSessionIfNecessary(this.note);

            await server.put(`notes/${this.noteId}/title`, {title}, this.componentId);
        });

        this.deleteNoteOnEscape = false;

        appContext.addBeforeUnloadListener(this);
    }

    isEnabled() {
        return super.isEnabled()
            && this.noteContext && this.noteContext.note && (this.noteContext.note.type == "task");
    }

    generateCommentUiStr(taskId, date, message) {
        
            return `<div class="task-comments-list">
                <style>
                    .task-comments-list {
                        display: flex;
                        margin-top:5px;
                        background-color: var(--accented-background-color);
                        
                    }

                    .task-comments-list-message {
                        right:0px; 
                        width: calc(100% - 160px);
                        height:100%; 
                        word-break: break-space;
                        white-space:pre-wrap;
                        margin: auto 0;
                    }

                    .task-comments-list-date {
                        left:0px; 
                        width: 160px; 
                        margin: auto 0;
                    }
                </style>
                <div class="task-comments-list-date">${date}</div>
                <div class="task-comments-list-message">${message}</div>
            </div>`;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$commentContainer = this.$widget.find(".task-comments-widget-container");  
        
        const input = this.$widget.find('.new-comment');
        input.on('keydown',async (e) => {
            if (e.code === 'Enter' && !e.shiftKey) {
                await this.addNewComment(input.val());
                input.val('');
            }
        });
    }

    populateComments(input) {
        const comments = input.reverse();
        this.$commentContainer?.empty();
        for(const i in comments) {
            const comment = comments[i];

            const domStr = this.generateCommentUiStr(`${this.$noteId}-${i}`, dayjs(comment.date).format("YYYY-MM-DD HH:mm:ss"), atob(comment.message));
            
            const item = $(domStr);
            this.$commentContainer.append(item);
        }
    }

    async getCurrentComments(noteId) {
        const attrs = await server.get(`notes/${noteId}/attributes`);
        for(const i in attrs) {
            const attr = attrs[i];
            if (attr.type === 'taskprop' && attr.name === 'comments') {
                const comments = attr.value === '' ? [] : JSON.parse(attr.value);
                return {comments: comments, attrId: attr.attributeId};
            }
        }
        const attrId = await server.post(`notes/${this.$noteId}/attributes`, {
            name: 'comments',
            type: 'taskprop',
            value: ''
        });

        return {comments: [], attrId: attrId};
    }

    async addNewComment(comment) {
        
        if (!this.$noteId) {
            return;
        }

        if (comment === '') {
            return;
        }

        const {comments, _} = await this.getCurrentComments(this.$noteId);
        
        comments.push({
            date: utils.localNowDateTime(),
            message: btoa(comment)
        });

        await server.put(`notes/${this.$noteId}/attribute`, {
            attributeId: this.$attrId,
            type: 'taskprop',
            name: 'comments',
            value: JSON.stringify(comments)
        });

        this.populateComments(comments);
    }

    async refreshWithNote(note) {
        this.$commentContainer?.empty();
        if (note && note.type === 'task') {

            this.$noteId = note.noteId;
            const {comments, attrId} = await this.getCurrentComments(note.noteId);
            this.populateComments(comments);
            this.$attrId = attrId;
        }

        this.setProtectedStatus(note);
    }

    /** @param {FNote} note */
    setProtectedStatus(note) {
        
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

    beforeUnloadEvent() {
        return this.spacedUpdate.isAllSavedAndTriggerUpdate();
    }
}
