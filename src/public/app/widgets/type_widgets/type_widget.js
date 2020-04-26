import TabAwareWidget from "../tab_aware_widget.js";

export default class TypeWidget extends TabAwareWidget {
    // for overriding
    static getType() {}

    /**
     * @param {NoteShort} note
     */
    async doRefresh(note) {}

    async refresh() {
        const thisWidgetType = this.constructor.getType();
        const noteWidgetType = await this.parent.getWidgetType();

        if (thisWidgetType !== noteWidgetType) {
            this.toggleInt(false);

            this.cleanup();
        }
        else {
            this.toggleInt(true);

            await this.doRefresh(this.note);
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

    autoBookDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }

    textPreviewDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }

    codePreviewDisabledEvent({tabContext}) {
        if (this.isTab(tabContext.tabId)) {
            this.refresh();
        }
    }
}