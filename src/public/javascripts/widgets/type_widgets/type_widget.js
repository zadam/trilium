import TabAwareWidget from "../tab_aware_widget.js";

export default class TypeWidget extends TabAwareWidget {
    constructor(parent) {
        super(parent);

        /** @var {NoteDetailWidget} */
        this.noteDetailWidget = parent;
    }

    // for overriding
    static getType() {}

    /**
     * @param {NoteShort} note
     */
    doRefresh(note) {}

    refresh() {
        const widgetType = this.constructor.getType();

        if (widgetType !== this.noteDetailWidget.type) {
            this.toggle(false);

            this.cleanup();
        }
        else {
            this.toggle(true);

            this.doRefresh(this.note);
        }
    }

    isActive() {
        return this.$widget.is(":visible");
    }
}