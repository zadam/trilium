import FlexContainer from "./flex_container.js";
import appContext from "../../services/app_context.js";

export default class PaneContainer extends FlexContainer {
    constructor(widgetFactory) {
        super('row');

        this.counter = 0;

        this.widgetFactory = widgetFactory;
        this.widgets = {};

        this.class('pane-container-widget');
        this.css('flex-grow', '1');
    }

    async newTabOpenedEvent({tabContext}) {
        const widget = this.widgetFactory();

        const $renderedWidget = widget.render();

        $renderedWidget.attr("data-tab-id", tabContext.tabId);

        $renderedWidget.on('click', () => appContext.tabManager.activateTab(tabContext.tabId));

        this.$widget.append($renderedWidget);

        this.widgets[tabContext.tabId] = widget;

        await widget.handleEvent('setTabContext', { tabContext });

        this.child(widget);

        this.refresh();
    }

    async openNewPaneCommand() {
        const tabContext = await appContext.tabManager.openEmptyTab(null, 'root', appContext.tabManager.getActiveTabContext().tabId);

        await appContext.tabManager.activateTab(tabContext.tabId);

        await tabContext.setEmpty();
    }

    async refresh() {
        this.toggleExt(true);
    }

    toggleInt(show) {} // not needed

    toggleExt(show) {
        const activeTabId = appContext.tabManager.getActiveTabContext().getMainTabContext().tabId;

        for (const tabId in this.widgets) {
            const tabContext = appContext.tabManager.getTabContextById(tabId);

            const widget = this.widgets[tabId];
            widget.toggleExt(show && activeTabId && [tabContext.tabId, tabContext.parentTabId].includes(activeTabId));

            if (!widget.hasBeenAlreadyShown) {
                widget.handleEvent('activeTabChanged', {tabContext});
            }
        }
    }

    /**
     * widget.hasBeenAlreadyShown is intended for lazy loading of cached tabs - initial note switches of new tabs
     * are not executed, we're waiting for the first tab activation and then we update the tab. After this initial
     * activation further note switches are always propagated to the tabs.
     */
    handleEventInChildren(name, data) {
        if (['tabNoteSwitched', 'tabNoteSwitchedAndActivated'].includes(name)) {
            // this event is propagated only to the widgets of a particular tab
            const widget = this.widgets[data.tabContext.tabId];

            if (!widget) {
                return Promise.resolve();
            }

            const promises = [];

            if (appContext.tabManager.getActiveTabContext().getMainTabContext() === data.tabContext.getMainTabContext()) {
                promises.push(widget.handleEvent('activeTabChanged', data));
            }

            for (const subTabContext of data.tabContext.getMainTabContext().getAllSubTabContexts()) {
                const subWidget = this.widgets[subTabContext.tabId];

                if (!subWidget) {
                    continue;
                }

                if (subTabContext !== data.tabContext && !subWidget.hasBeenAlreadyShown) {
                    promises.push(widget.handleEvent('activeTabChanged', {tabContext: subTabContext}));
                    continue;
                }

                if (subTabContext === data.tabContext && (subWidget.hasBeenAlreadyShown || name === 'tabNoteSwitchedAndActivated')) {
                    subWidget.hasBeenAlreadyShown = true;

                    promises.push(widget.handleEvent('tabNoteSwitched', data));
                }
            }

            if (name === 'tabNoteSwitchedAndActivated') {
                this.toggleExt(true);
            }

            return Promise.all(promises);
        }

        if (name === 'activeTabChanged') {
            const promises = [];

            for (const subTabContext of data.tabContext.getMainTabContext().getAllSubTabContexts()) {
                console.log("subTabContext", subTabContext);

                const widget = this.widgets[subTabContext.tabId];

                if (!widget.hasBeenAlreadyShown) {
                    widget.hasBeenAlreadyShown = true;

                    promises.push(widget.handleEvent(name, {tabContext: subTabContext}));
                }
            }

            this.toggleExt(true);

            return Promise.all(promises);
        } else {
            return super.handleEventInChildren(name, data);
        }
    }
}
