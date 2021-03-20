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

            this.triggerEvent('noteDetailRefreshed', {tabId: this.tabContext.tabId});
        }
    }

    isActive() {
        return this.$widget.is(":visible");
    }

    getContent() {}

    focus() {}

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
