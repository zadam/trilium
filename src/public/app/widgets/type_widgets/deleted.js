import TypeWidget from "./type_widget.js";

const TPL = `
<div class="note-detail-deleted note-detail-printable">
    <div style="padding: 100px;">
        <div class="alert alert-warning" style="padding: 20px;">
            This note has been deleted.
        </div>
    </div>
</div>`;

export default class DeletedTypeWidget extends TypeWidget {
    static getType() { return "deleted"; }

    doRender() {
        this.$widget = $(TPL);

        return this.$widget;
    }
}