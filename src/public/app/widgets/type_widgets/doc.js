import TypeWidget from "./type_widget.js";

const TPL = `<div class="note-detail-doc note-detail-printable">Z</div>`;

export default class DocTypeWidget extends TypeWidget {
    static getType() { return "doc"; }

    doRender() {
        this.$widget = $(TPL);

        super.doRender();
    }
}
