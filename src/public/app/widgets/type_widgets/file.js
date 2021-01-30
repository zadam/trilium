import utils from "../../services/utils.js";
import openService from "../../services/open.js";
import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-file note-detail-printable">
    <style>
        .type-file {
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
    
    <iframe class="pdf-preview" style="width: 100%; height: 100%; flex-grow: 100;"></iframe>
</div>`;

export default class FileTypeWidget extends TypeWidget {
    static getType() { return "file"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$previewContent = this.$widget.find(".file-preview-content");
        this.$pdfPreview = this.$widget.find(".pdf-preview");
    }

    async doRefresh(note) {
        const attributes = note.getAttributes();
        const attributeMap = utils.toObject(attributes, l => [l.name, l.value]);

        this.$widget.show();

        const noteComplement = await this.tabContext.getNoteComplement();

        this.$previewContent.empty().hide();
        this.$pdfPreview.attr('src', '').empty().hide();

        if (noteComplement.content) {
            this.$previewContent.show().scrollTop(0);
            this.$previewContent.text(noteComplement.content);
        }
        else if (note.mime === 'application/pdf') {
            this.$pdfPreview.show();
            this.$pdfPreview.attr("src", openService.getUrlForDownload("api/notes/" + this.noteId + "/open"));
        }
    }
}
