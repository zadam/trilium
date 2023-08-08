import TypeWidget from "./type_widget.js";

const TPL = `<div class="note-detail-none note-detail-printable"></div>`;

export default class NoneTypeWidget extends TypeWidget {
    static getType() { return "none"; }

    doRender() {
        this.$widget = $(TPL);

        super.doRender();
    }
}
