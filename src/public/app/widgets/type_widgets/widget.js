import TypeWidget from "./type_widget.js";

const TPL = `<div class="note-detail-widget note-detail-printable"></div>`;

export default class ContentWidgetTypeWidget extends TypeWidget {
    static getType() { return "content-widget"; }

    doRender() {
        this.$widget = $(TPL);

        super.doRender();
    }

    async doRefresh(note) {
        const contentWidget = note.getLabelValue('contentWidget');

        if (contentWidget === 'optionsAppearance') {
            this.$widget.empty().append("HI!");
        } else {
            this.$widget.empty().append(`Unknown widget of type "${contentWidget}"`);
        }
    }
}
