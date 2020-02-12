import TabAwareWidget from "../tab_aware_widget.js";

export default class TypeWidget extends TabAwareWidget {
    // for overriding
    static getType() {}

    /**
     * @param {NoteShort} note
     */
    doRefresh(note) {}

    refresh() {
        const note = this.tabContext.note;
        const widgetType = this.constructor.getType();

        if (!note
            || (note.type !== widgetType
                && (note.type !== 'text' || widgetType !== 'book') // text can be rendered as book if it does not have content
                && (widgetType !== 'protected-session' || !note.isProtected))) {
            this.toggle(false);

            this.cleanup();
        }
        else {
            this.toggle(true);

            this.doRefresh(note);
        }
    }

    isActive() {
        return this.$widget.is(":visible");
    }
}