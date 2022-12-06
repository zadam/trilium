import TypeWidget from "./type_widget.js";
import AppearanceOptions from "./options/appearance.js";

const TPL = `<div class="note-detail-content-widget note-detail-printable">
    <style>
        .note-detail-content-widget-content {
            padding: 15px;
        }
    </style>

    <div class="note-detail-content-widget-content"></div>
</div>`;

export default class ContentWidgetTypeWidget extends TypeWidget {
    static getType() { return "content-widget"; }

    doRender() {
        this.$widget = $(TPL);
        this.$content = this.$widget.find(".note-detail-content-widget-content");

        super.doRender();
    }

    async doRefresh(note) {
        const contentWidget = note.getLabelValue('contentWidget');

        this.$content.empty();
        this.children = [];

        if (contentWidget === 'optionsAppearance') {
            const widget = new AppearanceOptions();

            await widget.handleEvent('setNoteContext', { noteContext: this.noteContext });
            this.child(widget);

            this.$content.append(widget.render());
            await widget.refresh();
        } else {
            this.$content.append(`Unknown widget of type "${contentWidget}"`);
        }
    }
}
