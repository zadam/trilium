import NoteContextAwareWidget from "./note_context_aware_widget.js";
import server from "../services/server.js";
import fileWatcher from "../services/file_watcher.js";

const TPL = `
<div class="dropdown note-update-status-widget alert alert-warning">
    <style>
        .note-update-status-widget {
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

export default class NoteUpdateStatusWidget extends NoteContextAwareWidget {
    isEnabled() {
        return super.isEnabled()
            && !!fileWatcher.getFileModificationStatus(this.noteId);
    }

    doRender() {
        this.$widget = $(TPL);

        this.$filePath = this.$widget.find(".file-path");
        this.$fileLastModified = this.$widget.find(".file-last-modified");
        this.$fileUploadButton = this.$widget.find(".file-upload-button");

        this.$fileUploadButton.on("click", async () => {
            await server.post(`notes/${this.noteId}/upload-modified-file`, {
                filePath: this.$filePath.text()
            });

            fileWatcher.fileModificationUploaded(this.noteId);
            this.refresh();
        });

        this.$ignoreThisChangeButton = this.$widget.find(".ignore-this-change-button");
        this.$ignoreThisChangeButton.on('click', () => {
            fileWatcher.ignoreModification(this.noteId);
            this.refresh();
        });
    }

    refreshWithNote(note) {
        const status = fileWatcher.getFileModificationStatus(note.noteId);

        this.$filePath.text(status.filePath);
        this.$fileLastModified.text(dayjs.unix(status.lastModifiedMs / 1000).format("HH:mm:ss"));
    }

    openedFileUpdatedEvent(data) {
        if (data.noteId === this.noteId) {
            this.refresh();
        }
    }
}
