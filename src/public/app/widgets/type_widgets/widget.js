import TypeWidget from "./type_widget.js";

const TPL = `<div class="note-detail-widget note-detail-printable"></div>`;

export default class WidgetTypeWidget extends TypeWidget {
    static getType() { return "widget"; }

    doRender() {
        this.$widget = $(TPL);

        super.doRender();
    }

    async doRefresh(note) {
        const widgetName = note.getLabelValue('widget');

        if (widgetName === 'optionsAppearance') {
            this.$widget.empty().append("HI!");
        } else {
            this.$widget.empty().append(`Unknown widget of type "${widgetName}"`);
        }
    }
}
