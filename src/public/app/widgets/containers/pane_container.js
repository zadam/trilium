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

    setTabContextEvent({tabContext}) {
        /** @var {TabContext} */
        this.tabContext = tabContext;
    }

    async newTabOpenedEvent({tabContext}) {
        const widget = this.widgetFactory();

        const $renderedWidget = widget.render();

        $renderedWidget.on('click', () => {
            appContext.tabManager.activateTab(tabContext.tabId);
        });

        let $parent;

        if (!tabContext.parentTabId) {
            $parent = $("<div>")
                .attr("data-main-tab-id", tabContext.tabId)
                .css("display", "flex")
                .css("flex-grow", "1");

            this.$widget.append($parent);
        }
        else {
            $parent = this.$widget.find(`[data-main-tab-id="${tabContext.parentTabId}"]`);
        }

        $parent.append($renderedWidget);

        this.widgets[tabContext.tabId] = widget;

        await widget.handleEvent('setTabContext', { tabContext });

        this.child(widget);
    }

    async openNewPaneCommand() {
        const tabContext = await appContext.tabManager.openEmptyTab(null, null, appContext.tabManager.getActiveTabContext().tabId);

        await appContext.tabManager.activateTab(tabContext.tabId);

        await tabContext.setEmpty();
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

            if (widget && (widget.hasBeenAlreadyShown || name === 'tabNoteSwitchedAndActivated')) {
                widget.hasBeenAlreadyShown = true;

                return widget.handleEvent('tabNoteSwitched', data);
            }
            else {
                return Promise.resolve();
            }
        }

        if (name === 'activeTabChanged') {
            const widget = this.widgets[data.tabContext.tabId];

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
