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

    async openNewPaneCommand() {
        const newWidget = this.widgetFactory();

        this.$widget.append(newWidget.render());

        const tabContext = new TabContext();
        appContext.tabManager.tabContexts.push(tabContext);
        appContext.tabManager.child(tabContext);

        tabContext.parentTabId = appContext.tabManager.getActiveTabContext().tabId;

        await newWidget.handleEvent('setTabContext', { tabContext });

        this.child(newWidget);

        tabContext.setEmpty();

        appContext.tabManager.activateTab(tabContext.tabId);
    }
}
