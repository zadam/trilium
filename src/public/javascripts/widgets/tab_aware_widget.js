import BasicWidget from "./basic_widget.js";

export default class TabAwareWidget extends BasicWidget {
    constructor(appContext, tabContext = null) {
        super(appContext);

        /** @var {TabContext} */
        this.tabContext = tabContext;
    }

    // to override
    activeTabChanged() {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }
}