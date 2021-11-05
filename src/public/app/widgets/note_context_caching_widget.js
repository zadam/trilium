import NoteContextAwareWidget from "./note_context_aware_widget.js";
import keyboardActionsService from "../services/keyboard_actions.js";

export default class NoteContextCachingWidget extends NoteContextAwareWidget {
    constructor(widgetFactory) {
        super();

        this.widgetFactory = widgetFactory;
        this.widgets = {};
    }

    doRender() {
        return this.$widget = $(`<div class="marker" style="display: none;">`);
    }

    async newNoteContextCreatedEvent({noteContext}) {
        const {ntxId} = noteContext;

        if (this.widgets[ntxId]) {
            return;
        }

        this.widgets[ntxId] = this.widgetFactory();

        const $renderedWidget = this.widgets[ntxId].render();
        this.widgets[ntxId].toggleExt(false); // new tab is always not active, can be activated after creation

        this.$widget.after($renderedWidget);

        this.widgets[ntxId].handleEvent('initialRenderComplete');

        keyboardActionsService.updateDisplayedShortcuts($renderedWidget);

        await this.widgets[ntxId].handleEvent('setNoteContext', {noteContext});

        this.child(this.widgets[ntxId]); // add as child only once it is ready (rendered with noteContext)
    }

    noteContextRemovedEvent({ntxIds}) {
        for (const ntxId of ntxIds) {
            const widget = this.widgets[ntxId];

            if (widget) {
                widget.remove();
                delete this.widgets[ntxId];

                this.children = this.children.filter(ch => ch !== widget);
            }
        }
    }

    async refresh() {
        this.toggleExt(true);
    }

    toggleInt(show) {} // not needed

    toggleExt(show) {
        for (const ntxId in this.widgets) {
            this.widgets[ntxId].toggleExt(show && this.isNoteContext(ntxId));
        }
    }

    /**
     * widget.hasBeenAlreadyShown is intended for lazy loading of cached tabs - initial note switches of new tabs
     * are not executed, we're waiting for the first tab activation and then we update the tab. After this initial
     * activation further note switches are always propagated to the tabs.
     */
    handleEventInChildren(name, data) {
        if (['noteSwitched', 'noteSwitchedAndActivated'].includes(name)) {
            // this event is propagated only to the widgets of a particular tab
            const widget = this.widgets[data.noteContext.ntxId];

            if (widget && (widget.hasBeenAlreadyShown || name === 'noteSwitchedAndActivated')) {
                widget.hasBeenAlreadyShown = true;

                return widget.handleEvent('noteSwitched', data);
            }
            else {
                return Promise.resolve();
            }
        }

        if (name === 'activeContextChanged') {
            const widget = this.widgets[data.noteContext.ntxId];

            if (widget.hasBeenAlreadyShown) {
                return Promise.resolve();
            }
            else {
                widget.hasBeenAlreadyShown = true;

                return widget.handleEvent(name, data);
            }
        } else {
            return super.handleEventInChildren(name, data);
        }
    }
}
