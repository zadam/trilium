import FlexContainer from "./flex_container.js";
import appContext from "../../components/app_context.js";

export default class SplitNoteContainer extends FlexContainer {
    constructor(widgetFactory) {
        super('row');

        this.widgetFactory = widgetFactory;
        this.widgets = {};

        this.class('split-note-container-widget');
        this.css('flex-grow', '1');
        this.collapsible();
    }

    async newNoteContextCreatedEvent({noteContext}) {
        const widget = this.widgetFactory();

        const $renderedWidget = widget.render();

        $renderedWidget.attr("data-ntx-id", noteContext.ntxId);
        $renderedWidget.on('click', () => appContext.tabManager.activateNoteContext(noteContext.ntxId));

        this.$widget.append($renderedWidget);

        widget.handleEvent('initialRenderComplete');

        widget.toggleExt(false);

        this.widgets[noteContext.ntxId] = widget;

        await widget.handleEvent('setNoteContext', { noteContext });

        this.child(widget);
    }

    async openNewNoteSplitEvent({ntxId, notePath, hoistedNoteId}) {
        const mainNtxId = appContext.tabManager.getActiveMainContext().ntxId;

        if (!ntxId) {
            logError("empty ntxId!");

            ntxId = mainNtxId;
        }

        hoistedNoteId = hoistedNoteId || appContext.tabManager.getActiveContext().hoistedNoteId;

        const noteContext = await appContext.tabManager.openEmptyTab(null, hoistedNoteId, mainNtxId);

        // remove the original position of newly created note context
        const ntxIds = appContext.tabManager.children.map(c => c.ntxId)
            .filter(id => id !== noteContext.ntxId);

        // insert the note context after the originating note context
        ntxIds.splice(ntxIds.indexOf(ntxId) + 1, 0, noteContext.ntxId);

        this.triggerCommand("noteContextReorder", {ntxIdsInOrder: ntxIds});

        // move the note context rendered widget after the originating widget
        this.$widget.find(`[data-ntx-id="${noteContext.ntxId}"]`)
            .insertAfter(this.$widget.find(`[data-ntx-id="${ntxId}"]`));

        await appContext.tabManager.activateNoteContext(noteContext.ntxId);

        if (notePath) {
            await noteContext.setNote(notePath);
        }
        else {
            await noteContext.setEmpty();
        }
    }

    closeThisNoteSplitCommand({ntxId}) {
        appContext.tabManager.removeNoteContext(ntxId);
    }

    async moveThisNoteSplitCommand({ntxId, isMovingLeft}) {
        if (!ntxId) {
            logError("empty ntxId!");
            return;
        }

        const contexts = appContext.tabManager.noteContexts;

        const currentIndex = contexts.findIndex(c => c.ntxId === ntxId);
        const leftIndex = isMovingLeft ? currentIndex - 1 : currentIndex;

        if (currentIndex === -1 || leftIndex < 0 || leftIndex + 1 >= contexts.length) {
            logError(`invalid context! currentIndex: ${currentIndex}, leftIndex: ${leftIndex}, contexts.length: ${contexts.length}`);
            return;
        }

        if (contexts[leftIndex].isEmpty() && contexts[leftIndex + 1].isEmpty()) {
            // no op
            return;
        }

        const ntxIds = contexts.map(c => c.ntxId);
        const newNtxIds = [
            ...ntxIds.slice(0, leftIndex),
            ntxIds[leftIndex + 1],
            ntxIds[leftIndex],
            ...ntxIds.slice(leftIndex + 2),
        ];
        const isChangingMainContext = !contexts[leftIndex].mainNtxId;

        this.triggerCommand("noteContextReorder", {
            ntxIdsInOrder: newNtxIds,
            oldMainNtxId: isChangingMainContext ? ntxIds[leftIndex] : null,
            newMainNtxId: isChangingMainContext ? ntxIds[leftIndex + 1]: null,
        });

        // reorder the note context widgets
        this.$widget.find(`[data-ntx-id="${ntxIds[leftIndex]}"]`)
            .insertAfter(this.$widget.find(`[data-ntx-id="${ntxIds[leftIndex + 1]}"]`));

        // activate context that now contains the original note
        await appContext.tabManager.activateNoteContext(isMovingLeft ? ntxIds[leftIndex + 1] : ntxIds[leftIndex]);
    }

    activeContextChangedEvent() {
        this.refresh();
    }

    noteSwitchedAndActivatedEvent() {
        this.refresh();
    }

    noteContextRemovedEvent({ntxIds}) {
        this.children = this.children.filter(c => !ntxIds.includes(c.ntxId));

        for (const ntxId of ntxIds) {
            this.$widget.find(`[data-ntx-id="${ntxId}"]`).remove();

            delete this.widgets[ntxId];
        }
    }

    async refresh() {
        this.toggleExt(true);
    }

    toggleInt(show) {} // not needed

    toggleExt(show) {
        const activeMainContext = appContext.tabManager.getActiveMainContext();
        const activeNtxId = activeMainContext ? activeMainContext.ntxId : null;

        for (const ntxId in this.widgets) {
            const noteContext = appContext.tabManager.getNoteContextById(ntxId);

            const widget = this.widgets[ntxId];
            widget.toggleExt(show && activeNtxId && [noteContext.ntxId, noteContext.mainNtxId].includes(activeNtxId));
        }
    }

    /**
     * widget.hasBeenAlreadyShown is intended for lazy loading of cached tabs - initial note switches of new tabs
     * are not executed, we're waiting for the first tab activation, and then we update the tab. After this initial
     * activation further note switches are always propagated to the tabs.
     */
    handleEventInChildren(name, data) {
        if (['noteSwitched', 'noteSwitchedAndActivated'].includes(name)) {
            // this event is propagated only to the widgets of a particular tab
            const widget = this.widgets[data.noteContext.ntxId];

            if (!widget) {
                return Promise.resolve();
            }

            if (widget.hasBeenAlreadyShown
                || name === 'noteSwitchedAndActivated'
                || appContext.tabManager.getActiveMainContext() === data.noteContext.getMainContext()
            ) {
                widget.hasBeenAlreadyShown = true;

                return [
                    widget.handleEvent('noteSwitched', data),
                    this.refreshNotShown(data)
                ];
            }
            else {
                return Promise.resolve();
            }
        }

        if (name === 'activeContextChanged') {
            return this.refreshNotShown(data);
        } else {
            return super.handleEventInChildren(name, data);
        }
    }

    refreshNotShown(data) {
        const promises = [];

        for (const subContext of data.noteContext.getMainContext().getSubContexts()) {
            const widget = this.widgets[subContext.ntxId];

            if (!widget.hasBeenAlreadyShown) {
                widget.hasBeenAlreadyShown = true;

                promises.push(widget.handleEvent('activeContextChanged', {noteContext: subContext}));
            }
        }

        this.refresh();

        return Promise.all(promises);
    }
}
