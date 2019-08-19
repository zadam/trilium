import StandardWidget from "./standard_widget.js";

class WhatLinksHereWidget extends StandardWidget {
    getWidgetTitle() { return "What links here"; }

    async doRenderBody() {


        const $noteId = this.$body.find(".note-info-note-id");
        const $dateCreated = this.$body.find(".note-info-date-created");
        const $dateModified = this.$body.find(".note-info-date-modified");
        const $type = this.$body.find(".note-info-type");
        const $mime = this.$body.find(".note-info-mime");

        const note = this.ctx.note;

        $noteId.text(note.noteId);
        $dateCreated.text(note.dateCreated);
        $dateModified.text(note.dateModified);
        $type.text(note.type);
        $mime.text(note.mime);
    }

    syncDataReceived(syncData) {
        if (syncData.find(sd => sd.entityName === 'notes' && sd.entityId === this.ctx.note.noteId)) {
            this.doRenderBody();
        }
    }
}

export default WhatLinksHereWidget;