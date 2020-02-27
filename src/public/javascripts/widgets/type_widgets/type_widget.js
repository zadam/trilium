import TabAwareWidget from "../tab_aware_widget.js";

export default class TypeWidget extends TabAwareWidget {
    // for overriding
    static getType() {}

    /**
     * @param {NoteShort} note
     */
    doRefresh(note) {}

    async refresh() {
        const thisWidgetType = this.constructor.getType();
        const noteWidgetType = await this.parent.getWidgetType();

        if (thisWidgetType !== noteWidgetType) {
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

    getContent() {}

    focus() {}

    scrollToTop() {
        this.$widget.scrollTop(0);
    }
}