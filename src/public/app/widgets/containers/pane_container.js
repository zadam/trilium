import FlexContainer from "./flex_container.js";
import appContext from "../../services/app_context.js";
import TabContext from "../../services/tab_context.js";

export default class PaneContainer extends FlexContainer {
    constructor(widgetFactory) {
        super('row');

        this.counter = 0;

        this.widgetFactory = widgetFactory;

        this.child(this.widgetFactory());

        this.id('pane-container-widget');
        this.css('flex-grow', '1');
    }

    doRender() {
        super.doRender();

        this.$widget.find("div").on("click", () => {
            const activeTabContext = appContext.tabManager.getActiveTabContext();

            const tabId = activeTabContext.parentTabId || activeTabContext.tabId;

            appContext.tabManager.activateTab(tabId);
        });
    }

    async openNewPaneCommand() {
        const newWidget = this.widgetFactory();

        const $rendered = newWidget.render();

        this.$widget.append($rendered);

        const tabContext = new TabContext();
        appContext.tabManager.tabContexts.push(tabContext);
        appContext.tabManager.child(tabContext);

        $rendered.on('click', () => {
            appContext.tabManager.activateTab(tabContext.tabId);
        });

        tabContext.parentTabId = appContext.tabManager.getActiveTabContext().tabId;

        await newWidget.handleEvent('setTabContext', { tabContext });

        this.child(newWidget);

        tabContext.setEmpty();

        appContext.tabManager.activateTab(tabContext.tabId);
    }
}
