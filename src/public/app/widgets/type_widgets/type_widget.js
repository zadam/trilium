import NoteContextAwareWidget from "../note_context_aware_widget.js";
import appContext from "../../components/app_context.js";

export default class TypeWidget extends NoteContextAwareWidget {
    // for overriding
    static getType() {}

    doRender() {
        this.contentSized();

        return super.doRender();
    }

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

            this.triggerEvent('noteDetailRefreshed', {ntxId: this.noteContext.ntxId});
        }
    }

    isActive() {
        return this.$widget.is(":visible") && this.noteContext?.ntxId === appContext.tabManager.activeNtxId;
    }

    /**
     * @returns {Promise|*} promise resolving content or directly the content
     */
    getContent() {}

    focus() {}

    async readOnlyTemporarilyDisabledEvent({noteContext}) {
        if (this.isNoteContext(noteContext.ntxId)) {
            await this.refresh();

            this.focus();
        }
    }

    // events should be propagated manually to the children widgets
    handleEventInChildren(name, data) {
        if (['activeContextChanged', 'setNoteContext'].includes(name)) {
            // won't trigger .refresh();
            return super.handleEventInChildren('setNoteContext', data);
        }
        else if (name === 'entitiesReloaded') {
            return super.handleEventInChildren(name, data);
        }
        else {
            return Promise.resolve();
        }
    }
}
