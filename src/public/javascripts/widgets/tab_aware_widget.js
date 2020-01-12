import BasicWidget from "./basic_widget.js";

export default class TabAwareWidget extends BasicWidget {
    constructor(appContext) {
        super(appContext);

        /** @var {TabContext} */
        this.tabContext = null;
    }

    // to override
    activeTabChanged() {}

    activeTabChangedListener() {
        this.tabContext = this.appContext.getActiveTabContext();

        this.activeTabChanged();
    }
}