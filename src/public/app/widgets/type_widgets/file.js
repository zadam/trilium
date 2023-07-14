import openService from "../../services/open.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-file note-detail-printable">
    <style>
        .type-file .note-detail {
            height: 100%;
        }
        
        .note-detail-file {
            padding: 10px;
            height: 100%;
        }

        .file-preview-content {
            background-color: var(--accented-background-color);
            padding: 15px;
            height: 100%;
            overflow: auto;
            margin: 10px;
        }
    </style>
    
    <pre class="file-preview-content"></pre>
    
    <div class="file-preview-not-available alert alert-info">
        File preview is not available for this file format.
    </div>
    
    <iframe class="pdf-preview" style="width: 100%; height: 100%; flex-grow: 100;"></iframe>
    
    <video class="video-preview" controls></video>
    
    <audio class="audio-preview" controls></audio>
</div>`;

export default class FileTypeWidget extends TypeWidget {
    static getType() { return "file"; }

    doRender() {
        this.$widget = $(TPL);
        this.$previewContent = this.$widget.find(".file-preview-content");
        this.$previewNotAvailable = this.$widget.find(".file-preview-not-available");
        this.$pdfPreview = this.$widget.find(".pdf-preview");
        this.$videoPreview = this.$widget.find(".video-preview");
        this.$audioPreview = this.$widget.find(".audio-preview");

        super.doRender();
    }

    async doRefresh(note) {
        this.$widget.show();

        const blob = await this.note.getBlob();

        this.$previewContent.empty().hide();
        this.$pdfPreview.attr('src', '').empty().hide();
        this.$previewNotAvailable.hide();
        this.$videoPreview.hide();
        this.$audioPreview.hide();

        if (blob.content) {
            this.$previewContent.show().scrollTop(0);
            this.$previewContent.text(blob.content);
        }
        else if (note.mime === 'application/pdf') {
            this.$pdfPreview.show().attr("src", openService.getUrlForDownload(`api/notes/${this.noteId}/open`));
        }
        else if (note.mime.startsWith('video/')) {
            this.$videoPreview
                .show()
                .attr("src", openService.getUrlForDownload(`api/notes/${this.noteId}/open-partial`))
                .attr("type", this.note.mime)
                .css("width", this.$widget.width());
        }
        else if (note.mime.startsWith('audio/')) {
            this.$audioPreview
                .show()
                .attr("src", openService.getUrlForDownload(`api/notes/${this.noteId}/open-partial`))
                .attr("type", this.note.mime)
                .css("width", this.$widget.width());
        }
        else {
            this.$previewNotAvailable.show();
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            this.refresh();
        }
    }
}
