import TabAwareWidget from "../tab_aware_widget.js";

export default class TypeWidget extends TabAwareWidget {
    // for overriding
    static getType() {}

    doRefresh() {}

    refresh() {
        if (!this.tabContext.note || this.tabContext.note.type !== this.constructor.getType()) {
            this.toggle(false);

            return;
        }

        this.doRefresh();
    }
}