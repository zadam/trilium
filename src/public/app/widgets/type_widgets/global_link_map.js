import TypeWidget from "./type_widget.js";

const TPL = `<div class="note-detail-global-link-map note-detail-printable">WHATSUP</div>`;

export default class GlobalLinkMapTypeWidget extends TypeWidget {
    static getType() { return "globallinkmap"; }

    doRender() {
        this.$widget = $(TPL);

        super.doRender();
    }
}
