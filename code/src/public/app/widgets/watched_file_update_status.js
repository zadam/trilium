import NoteContextAwareWidget from "./note_context_aware_widget.js";
import server from "../services/server.js";
import fileWatcher from "../services/file_watcher.js";

const TPL = `
<div class="dropdown watched-file-update-status-widget alert alert-warning">
    <style>
        .watched-file-update-status-widget {
            margin: 10px;
            contain: none;
        }
    </style>
    
    <p>File <code class="file-path"></code> has been last modified on <span class="file-last-modified"></span>.</p> 

    <div style="display: flex; flex-direction: row; justify-content: space-evenly;">
        <button class="btn btn-sm file-upload-button">Upload modified file</button>
        
        <button class="btn btn-sm ignore-this-change-button">Ignore this change</button>
    </div>
</div>`;

export default class WatchedFileUpdateStatusWidget extends NoteContextAwareWidget {
    isEnabled() {
        const { entityType, entityId } = this.getEntity();

        return super.isEnabled() && !!fileWatcher.getFileModificationStatus(entityType, entityId);
    }

    doRender() {
        this.$widget = $(TPL);

        this.$filePath = this.$widget.find(".file-path");
        this.$fileLastModified = this.$widget.find(".file-last-modified");
        this.$fileUploadButton = this.$widget.find(".file-upload-button");

        this.$fileUploadButton.on("click", async () => {
            const { entityType, entityId } = this.getEntity();

            await server.post(`${entityType}/${entityId}/upload-modified-file`, {
                filePath: this.$filePath.text()
            });

            fileWatcher.fileModificationUploaded(entityType, entityId);
            this.refresh();
        });

        this.$ignoreThisChangeButton = this.$widget.find(".ignore-this-change-button");
        this.$ignoreThisChangeButton.on('click', () => {
            const { entityType, entityId } = this.getEntity();

            fileWatcher.ignoreModification(entityType, entityId);
            this.refresh();
        });
    }

    async refreshWithNote(note) {
        const { entityType, entityId } = this.getEntity();
        const status = fileWatcher.getFileModificationStatus(entityType, entityId);

        this.$filePath.text(status.filePath);
        this.$fileLastModified.text(dayjs.unix(status.lastModifiedMs / 1000).format("HH:mm:ss"));
    }

    getEntity() {
        if (!this.noteContext) {
            return {};
        }

        const { viewScope } = this.noteContext;

        if (viewScope.viewMode === 'attachments' && viewScope.attachmentId) {
            return {
                entityType: 'attachments',
                entityId: viewScope.attachmentId
            };
        } else {
            return {
                entityType: 'notes',
                entityId: this.noteId
            };
        }
    }

    openedFileUpdatedEvent(data) {console.log(data);
        const { entityType, entityId } = this.getEntity();

        if (data.entityType === entityType && data.entityId === entityId) {
            this.refresh();
        }
    }
}
